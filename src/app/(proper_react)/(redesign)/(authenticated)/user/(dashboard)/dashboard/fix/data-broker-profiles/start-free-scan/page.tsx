/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { headers } from "next/headers";
import { getLatestOnerepScanResults } from "../../../../../../../../../../db/tables/onerep_scans";
import { redirect } from "next/navigation";
import { getServerSession } from "../../../../../../../../../functions/server/getServerSession";
import {
  getHelloPrivacyCustomerId,
  getOnerepProfileId,
} from "../../../../../../../../../../db/tables/subscribers";
import { getCountryCode } from "../../../../../../../../../functions/server/getCountryCode";
import { StepDeterminationData } from "../../../../../../../../../functions/server/getRelevantGuidedSteps";
import { getSubscriberBreaches } from "../../../../../../../../../functions/server/getSubscriberBreaches";
import { getSubscriberEmails } from "../../../../../../../../../functions/server/getSubscriberEmails";
import { StartFreeScanView } from "./StartFreeScanView";
import { getEnabledFeatureFlags } from "../../../../../../../../../../db/tables/featureFlags";
import { getLatestScanRecords } from "../../../../../../../../../../db/tables/helloprivacy_scans";

export default async function StartFreeScanPage() {
  const countryCode = getCountryCode(headers());
  if (countryCode !== "us") {
    redirect("/user/dashboard");
  }

  const session = await getServerSession();
  if (!session?.user?.subscriber?.id) {
    return redirect("/");
  }

  const enabledFeatures = getEnabledFeatureFlags({ email: session.user.email });
  let latestScanData;
  if ((await enabledFeatures).includes("HelloPrivacy")) {
    const customerId = await getHelloPrivacyCustomerId(
      session.user.subscriber.id,
    );

    latestScanData =
      typeof customerId === "string"
        ? await getLatestScanRecords(customerId)
        : undefined;
    if (latestScanData?.scan) {
      // If the user already has done a scan, let them view their results:
      return redirect(
        "/user/dashboard/fix/data-broker-profiles/view-data-brokers",
      );
    }
  } else {
    const onerepProfileId = await getOnerepProfileId(
      session.user.subscriber.id,
    );

    latestScanData =
      typeof onerepProfileId === "number"
        ? await getLatestOnerepScanResults(onerepProfileId)
        : undefined;
    if (latestScanData?.scan) {
      // If the user already has done a scan, let them view their results:
      return redirect(
        "/user/dashboard/fix/data-broker-profiles/view-data-brokers",
      );
    }
  }

  const data: StepDeterminationData = {
    countryCode,
    user: session.user,
    latestScanData: latestScanData ?? null,
    subscriberBreaches: await getSubscriberBreaches({
      fxaUid: session.user.subscriber.fxa_uid,
      countryCode,
    }),
  };
  const subscriberEmails = await getSubscriberEmails(session.user);

  return <StartFreeScanView data={data} subscriberEmails={subscriberEmails} />;
}
