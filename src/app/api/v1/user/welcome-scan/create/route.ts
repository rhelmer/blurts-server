/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { logger } from "../../../../../functions/server/logging";
import { getServerSession } from "../../../../../functions/server/getServerSession";
import {
  createProfile,
  createScan,
  isEligibleForFreeScan,
} from "../../../../../functions/server/onerep";
import {
  createScan as createHelloPrivacyScan,
  isEligibleForFreeScan as isEligibleForHelloPrivacyFreeScan,
} from "../../../../../functions/server/helloprivacy";
import type { CreateProfileRequest } from "../../../../../functions/server/onerep";
import { meetsAgeRequirement } from "../../../../../functions/universal/user";
import AppConstants from "../../../../../../appConstants";
import {
  getHelloPrivacyCustomerId,
  getSubscriberByFxaUid,
  setHelloPrivacyCustomerId,
} from "../../../../../../db/tables/subscribers";
import {
  setOnerepProfileId,
  setOnerepScan,
} from "../../../../../../db/tables/onerep_scans";
import { setProfileDetails } from "../../../../../../db/tables/onerep_profiles";
import { StateAbbr } from "../../../../../../utils/states";
import { ISO8601DateString } from "../../../../../../utils/parse";
import { getCountryCode } from "../../../../../functions/server/getCountryCode";
import { getExperimentationId } from "../../../../../functions/server/getExperimentationId";
import { getExperiments } from "../../../../../functions/server/getExperiments";
import { getLocale } from "../../../../../functions/universal/getLocale";
import { getL10n } from "../../../../../functions/l10n/serverComponents";
import { getEnabledFeatureFlags } from "../../../../../../db/tables/featureFlags";
import { setHelloPrivacyProfileDetails } from "../../../../../../db/tables/helloprivacy_profiles";
import { randomUUID } from "crypto";
import {
  getScansCountForCustomerId,
  setHelloPrivacyScan,
} from "../../../../../../db/tables/helloprivacy_scans";

export interface WelcomeScanBody {
  success: boolean;
}

export interface UserInfo {
  firstName: string;
  lastName: string;
  city: string;
  state: StateAbbr;
  dateOfBirth: ISO8601DateString;
  middleName?: string;
  nameSuffix?: string;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<WelcomeScanBody> | NextResponse<unknown>> {
  const session = await getServerSession();
  const searchParams = req.nextUrl.searchParams;

  if (!session?.user?.subscriber) {
    throw new Error("No fxa_uid found in session");
  }

  const enabledFlags = await getEnabledFeatureFlags({
    email: session.user.email,
    ignoreAllowlist: false,
  });

  let eligible = false;
  if (enabledFlags.includes("HelloPrivacy")) {
    eligible = await isEligibleForHelloPrivacyFreeScan(
      session.user,
      getCountryCode(headers()),
    );
  } else {
    eligible = await isEligibleForFreeScan(
      session.user,
      getCountryCode(headers()),
    );
  }
  if (!eligible) {
    throw new Error("User is not eligible for feature");
  }

  const params: UserInfo = await req.json();
  const requiredParamKeys: Array<keyof UserInfo> = [
    "firstName",
    "lastName",
    "city",
    "state",
    "dateOfBirth",
  ];
  requiredParamKeys.forEach((requiredParamKey) => {
    if (!params[requiredParamKey]) {
      throw new Error(`${requiredParamKey} is required`);
    }
  });

  const {
    firstName,
    middleName,
    lastName,
    nameSuffix,
    city,
    state,
    dateOfBirth,
  } = params;
  if (!meetsAgeRequirement(dateOfBirth)) {
    throw new Error(`User does not meet the age requirement: ${dateOfBirth}`);
  }

  const experimentationId = getExperimentationId(session.user);
  const experimentData = await getExperiments({
    experimentationId: experimentationId,
    countryCode: getCountryCode(headers()),
    locale: getLocale(getL10n()),
    previewMode: searchParams.get("nimbus_web_preview") === "true",
  });
  const optionalInfoIsEnabled =
    experimentData["welcome-scan-optional-info"].enabled;

  const profileData: CreateProfileRequest = {
    first_name: firstName,
    last_name: lastName,
    addresses: [{ city, state }],
    birth_date: dateOfBirth,
    ...(optionalInfoIsEnabled && {
      middle_name: middleName,
      name_suffix: nameSuffix,
    }),
  };

  if (typeof session?.user?.subscriber.fxa_uid === "string") {
    try {
      const subscriber = await getSubscriberByFxaUid(
        session.user.subscriber.fxa_uid,
      );

      if (!subscriber) {
        throw new Error("No subscriber found for current session.");
      }

      if (enabledFlags.includes("HelloPrivacy")) {
        let customerId = await getHelloPrivacyCustomerId(subscriber.id);

        // If no customer ID exists, generate one and store it.
        if (!customerId) {
          // Create HelloPrivacy profile
          customerId = randomUUID();
          await setHelloPrivacyProfileDetails(
            subscriber.id,
            customerId,
            profileData,
          );
          await setHelloPrivacyCustomerId(subscriber, customerId);
        }

        // Only start exposure scan if it has not been performed yet.
        const scanCount = await getScansCountForCustomerId(customerId);
        if (scanCount === 0) {
          // Start exposure scan
          const helloPrivacyProfile = {
            birthYear: new Date(profileData.birth_date!).getFullYear(),
            birthMonth: new Date(profileData.birth_date!).getMonth(),
            name: {
              first: profileData.first_name,
              // middle: profileData.middle_name,
              last: profileData.last_name,
              // suffix: profileData.name_suffix,
            },
            addresses: profileData.addresses,
          };
          const scan = await createHelloPrivacyScan(
            customerId,
            helloPrivacyProfile,
          );
          await setHelloPrivacyScan(customerId, scan);
        }
      } else {
        if (!subscriber.onerep_profile_id) {
          // Create OneRep profile
          const profileId = await createProfile(profileData);
          await setOnerepProfileId(subscriber, profileId);
          await setProfileDetails(profileId, profileData);

          // Start exposure scan
          const scan = await createScan(profileId);
          const scanId = scan.id;
          await setOnerepScan(profileId, scanId, scan.status, "manual");
          // TODO MNTOR-2686 - refactor onerep.ts and centralize logging.
          logger.info("scan_created", {
            onerepScanId: scanId,
            onerepScanStatus: scan.status,
            onerepScanReason: "manual",
          });

          return NextResponse.json({ success: true }, { status: 200 });
        }
      }

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
      if (e instanceof Error) {
        logger.error("create_scan_failed", {
          stack: e.stack,
          message: e.message,
        });
      } else {
        logger.error("create_scan_failed", e);
      }
      return NextResponse.json({ success: false }, { status: 500 });
    }
  } else {
    // Not Signed in, redirect to home
    return NextResponse.redirect(AppConstants.SERVER_URL, 302);
  }
}
