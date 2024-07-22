/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { NextRequest, NextResponse } from "next/server";

import { logger } from "../../../../../functions/server/logging";

import { getServerSession } from "../../../../../functions/server/getServerSession";
import AppConstants from "../../../../../../appConstants";
import {
  getOnerepProfileId,
  getHelloPrivacyCustomerId,
  getSubscriberByFxaUid,
} from "../../../../../../db/tables/subscribers";

import {
  getLatestOnerepScanResults,
  addOnerepScanResults,
} from "../../../../../../db/tables/onerep_scans";
import {
  ListScanResultsResponse,
  Scan,
  getScanDetails,
  getAllScanResults,
} from "../../../../../functions/server/onerep";
import { getEnabledFeatureFlags } from "../../../../../../db/tables/featureFlags";
import {
  getScan,
  getScanRecords,
} from "../../../../../functions/server/helloprivacy";
import {
  addHelloPrivacyScanResults,
  getLatestScan,
} from "../../../../../../db/tables/helloprivacy_scans";

export interface ScanProgressBody {
  success: boolean;
  scan?: Scan;
  results?: ListScanResultsResponse;
}

// Periodically checking the scan progress and set the result if finished.
// A webhook is used as well, but this ensures that we get the latest data.
// @see the onerep-events route and https://docs.onerep.com/#section/Webhooks-Endpoints
export async function GET(
  _req: NextRequest,
): Promise<NextResponse<ScanProgressBody> | NextResponse<unknown>> {
  const session = await getServerSession();
  if (typeof session?.user?.subscriber?.fxa_uid === "string") {
    try {
      const subscriber = await getSubscriberByFxaUid(
        session.user.subscriber?.fxa_uid,
      );
      if (!subscriber) {
        throw new Error("No subscriber found for current session.");
      }

      const enabledFlags = await getEnabledFeatureFlags({
        email: session.user.email,
        ignoreAllowlist: false,
      });

      if (enabledFlags.includes("HelloPrivacy")) {
        const customerId = await getHelloPrivacyCustomerId(subscriber.id);

        const latestScan = await getLatestScan(customerId);
        const latestScanId = latestScan?.scan_id;

        if (
          typeof latestScanId !== "undefined" &&
          typeof customerId === "string"
        ) {
          const scan = await getScan(latestScanId);

          if (scan.status === "active" || scan.status === "done") {
            const allScanResults = await getScanRecords(scan.id);
            await addHelloPrivacyScanResults(customerId, allScanResults);
          }

          return NextResponse.json(
            { success: true, status: scan.status },
            { status: 200 },
          );
        }
      } else {
        const profileId = await getOnerepProfileId(subscriber.id);

        const latestScan = await getLatestOnerepScanResults(profileId);
        const latestScanId = latestScan.scan?.onerep_scan_id;

        if (
          typeof latestScanId !== "undefined" &&
          typeof profileId === "number"
        ) {
          const scan = await getScanDetails(profileId, latestScanId);

          // Store scan results.
          if (scan.status === "finished") {
            const allScanResults = await getAllScanResults(profileId);
            await addOnerepScanResults(profileId, allScanResults);
          }

          return NextResponse.json(
            { success: true, status: scan.status },
            { status: 200 },
          );
        }
      }

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
      if (e instanceof Error) {
        logger.error("failed_checking_scan_progress", {
          stack: e.stack,
          message: e.message,
        });
      } else {
        logger.error("failed_checking_scan_progress", { e });
      }
      return NextResponse.json({ success: false }, { status: 500 });
    }
  } else {
    // Not Signed in, redirect to home
    return NextResponse.redirect(AppConstants.SERVER_URL, 302);
  }
}
