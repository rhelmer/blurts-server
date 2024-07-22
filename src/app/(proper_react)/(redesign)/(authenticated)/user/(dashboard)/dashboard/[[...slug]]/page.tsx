/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "../../../../../../../functions/server/getServerSession";
import { TabType, View } from "../View";
import { getCountryCode } from "../../../../../../../functions/server/getCountryCode";
import { getSubscriberBreaches } from "../../../../../../../functions/server/getSubscriberBreaches";
import {
  canSubscribeToPremium,
  hasPremium,
} from "../../../../../../../functions/universal/user";
import {
  getLatestOnerepScanResults,
  getLatestScanForProfileByReason,
  getScansCountForProfile,
} from "../../../../../../../../db/tables/onerep_scans";
import {
  getHelloPrivacyCustomerId,
  getOnerepProfileId,
  getSignInCount,
} from "../../../../../../../../db/tables/subscribers";

import {
  activateAndOptoutProfile,
  getProfilesStats,
  isEligibleForFreeScan,
  isEligibleForPremium,
} from "../../../../../../../functions/server/onerep";
import {
  getSubscriptionBillingAmount,
  getPremiumSubscriptionUrl,
} from "../../../../../../../functions/server/getPremiumSubscriptionInfo";
import {
  refreshStoredScanRecords,
  refreshStoredScanResults,
} from "../../../../../../../functions/server/refreshStoredScanResults";
import { getEnabledFeatureFlags } from "../../../../../../../../db/tables/featureFlags";
import { getAttributionsFromCookiesOrDb } from "../../../../../../../functions/server/attributions";
import { checkSession } from "../../../../../../../functions/server/checkSession";
import { isPrePlusUser } from "../../../../../../../functions/server/isPrePlusUser";
import { getExperimentationId } from "../../../../../../../functions/server/getExperimentationId";
import { getElapsedTimeInDaysSinceInitialScan } from "../../../../../../../functions/server/getElapsedTimeInDaysSinceInitialScan";
import { getExperiments } from "../../../../../../../functions/server/getExperiments";
import { getLocale } from "../../../../../../../functions/universal/getLocale";
import { getL10n } from "../../../../../../../functions/l10n/serverComponents";
import { getLatestScanRecords } from "../../../../../../../../db/tables/helloprivacy_scans";
import { isEligibleForFreeScan as isEligibleForHelloPrivacyFreeScan } from "../../../../../../../functions/server/helloprivacy";

const dashboardTabSlugs = ["action-needed", "fixed"];

type Props = {
  params: {
    slug: string[] | undefined;
  };
  searchParams: {
    nimbus_web_preview?: string;
  };
};

export default async function DashboardPage({ params, searchParams }: Props) {
  const session = await getServerSession();
  if (!checkSession(session) || !session?.user?.subscriber?.id) {
    return redirect("/");
  }

  const { slug } = params;
  const isPremiumUser = hasPremium(session.user);
  const defaultTab = isPremiumUser ? "fixed" : "action-needed";
  const activeTab = (slug?.[0] ?? defaultTab) as TabType;
  // Only allow the tab slugs. Otherwise: Redirect to the default dashboard route.
  if (
    typeof slug !== "undefined" &&
    (!(activeTab && dashboardTabSlugs.includes(activeTab)) || slug.length >= 2)
  ) {
    return redirect(`/user/dashboard/${defaultTab}`);
  }

  const headersList = headers();
  const countryCode = getCountryCode(headersList);

  const enabledFeatureFlags = await getEnabledFeatureFlags({
    email: session.user.email,
  });

  const isNewUser = !isPrePlusUser(session.user);

  let latestScan;
  let scanCount;
  let hasFirstMonitoringScan;
  let userIsEligibleForFreeScan;
  let userIsEligibleForPremium;

  if (enabledFeatureFlags.includes("HelloPrivacy")) {
    const customerId = await getHelloPrivacyCustomerId(
      session.user.subscriber.id,
    );
    const hasRunScan = typeof customerId === "string";

    if (hasRunScan) {
      // TODO refresh
    } else if (canSubscribeToPremium({ user: session.user, countryCode })) {
      return redirect("/user/welcome");
    }

    latestScan = await getLatestScanRecords(customerId);

    userIsEligibleForFreeScan = await isEligibleForHelloPrivacyFreeScan(
      session.user,
      countryCode,
    );

    userIsEligibleForPremium = isEligibleForPremium(countryCode);

    scanCount = 1; // FIXME
    hasFirstMonitoringScan = false; //FIXME

    await refreshStoredScanRecords(customerId);
  } else {
    const profileId = await getOnerepProfileId(session.user.subscriber.id);
    const hasRunScan = typeof profileId === "number";
    if (hasRunScan) {
      await refreshStoredScanResults(profileId);

      // If the current user is a subscriber and their OneRep profile is not
      // activated: Most likely we were not able or failed to kick-off the
      // auto-removal process.
      // Let’s make sure the users OneRep profile is activated:
      if (isPremiumUser) {
        await activateAndOptoutProfile({ profileId });
      }
    } else if (
      isPremiumUser ||
      (isNewUser &&
        canSubscribeToPremium({
          user: session.user,
          countryCode,
        }))
    ) {
      return redirect("/user/welcome");
    }

    latestScan = await getLatestOnerepScanResults(profileId);
    scanCount =
      typeof profileId === "number"
        ? await getScansCountForProfile(profileId)
        : 0;

    hasFirstMonitoringScan = profileId
      ? typeof (await getLatestScanForProfileByReason(
          profileId,
          "monitoring",
        )) !== "undefined"
      : false;

    userIsEligibleForFreeScan = await isEligibleForFreeScan(
      session.user,
      countryCode,
    );

    userIsEligibleForPremium = isEligibleForPremium(countryCode);
  }

  const subBreaches = await getSubscriberBreaches({
    fxaUid: session.user.subscriber.fxa_uid,
    countryCode,
  });

  const experimentationId = getExperimentationId(session.user);
  const experimentData = await getExperiments({
    experimentationId: experimentationId,
    countryCode: countryCode,
    locale: getLocale(getL10n()),
    previewMode: searchParams.nimbus_web_preview === "true",
  });

  const monthlySubscriptionUrl = getPremiumSubscriptionUrl({ type: "monthly" });
  const yearlySubscriptionUrl = getPremiumSubscriptionUrl({ type: "yearly" });
  const fxaSettingsUrl = process.env.FXA_SETTINGS_URL!;
  const profileStats = await getProfilesStats();
  const additionalSubplatParams = await getAttributionsFromCookiesOrDb(
    session.user.subscriber.id,
  );
  const elapsedTimeInDaysSinceInitialScan =
    await getElapsedTimeInDaysSinceInitialScan(session.user);

  const signInCount = await getSignInCount(session.user.subscriber.id);

  return (
    <View
      user={session.user}
      isEligibleForPremium={userIsEligibleForPremium}
      isEligibleForFreeScan={userIsEligibleForFreeScan}
      userScanData={latestScan}
      userBreaches={subBreaches}
      enabledFeatureFlags={enabledFeatureFlags}
      monthlySubscriptionUrl={`${monthlySubscriptionUrl}&${additionalSubplatParams.toString()}`}
      yearlySubscriptionUrl={`${yearlySubscriptionUrl}&${additionalSubplatParams.toString()}`}
      subscriptionBillingAmount={getSubscriptionBillingAmount()}
      fxaSettingsUrl={fxaSettingsUrl}
      scanCount={scanCount}
      totalNumberOfPerformedScans={profileStats?.total}
      isNewUser={isNewUser}
      elapsedTimeInDaysSinceInitialScan={elapsedTimeInDaysSinceInitialScan}
      experimentationId={experimentationId}
      experimentData={experimentData}
      activeTab={activeTab}
      hasFirstMonitoringScan={hasFirstMonitoringScan}
      signInCount={signInCount}
    />
  );
}
