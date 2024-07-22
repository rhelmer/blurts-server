/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Session } from "next-auth";
import { OnerepScanResultRow } from "knex/types/tables";
import styles from "./View.module.scss";
import { Toolbar } from "../../../../../../components/client/toolbar/Toolbar";
import { DashboardTopBanner } from "./DashboardTopBanner";
import { useL10n } from "../../../../../../hooks/l10n";
import {
  Exposure,
  ExposureCard,
  isScanResult,
} from "../../../../../../components/client/exposure_card/ExposureCard";
import {
  ExposuresFilter,
  FilterState,
} from "../../../../../../components/client/ExposuresFilter";
import { getDashboardSummary } from "../../../../../../functions/server/dashboard";
import { getExposureStatus } from "../../../../../../components/server/StatusPill";
import { TabList } from "../../../../../../components/client/TabList";
import { filterExposures } from "./filterExposures";
import { SubscriberBreach } from "../../../../../../../utils/subscriberBreaches";
import {
  canSubscribeToPremium,
  hasPremium,
} from "../../../../../../functions/universal/user";
import { LatestOnerepScanData } from "../../../../../../../db/tables/onerep_scans";
import { getLocale } from "../../../../../../functions/universal/getLocale";
import { Button } from "../../../../../../components/client/Button";

import AllFixedIllustration from "./images/dashboard-all-fixed.svg";
import NoExposuresIllustration from "./images/dashboard-no-exposures.svg";
import ScanProgressIllustration from "./images/scan-illustration.svg";
import { CountryCodeContext } from "../../../../../../../contextProviders/country-code";
import { FeatureFlagName } from "../../../../../../../db/tables/featureFlags";
import { getNextGuidedStep } from "../../../../../../functions/server/getRelevantGuidedSteps";
import { CsatSurvey } from "../../../../../../components/client/csat_survey/CsatSurvey";
import { WaitlistDialog } from "../../../../../../components/client/SubscriberWaitlistDialog";
import { useOverlayTriggerState } from "react-stately";
import { useOverlayTrigger } from "react-aria";
import { useTelemetry } from "../../../../../../hooks/useTelemetry";
import {
  CONST_ONEREP_DATA_BROKER_COUNT,
  CONST_ONEREP_MAX_SCANS_THRESHOLD,
} from "../../../../../../../constants";
import { ExperimentData } from "../../../../../../../telemetry/generated/nimbus/experiments";
import { PetitionBanner } from "../../../../../../components/client/PetitionBanner";
import { Broker } from "../../../../../../functions/server/helloprivacy";

export type TabType = "action-needed" | "fixed";

export type Props = {
  enabledFeatureFlags: FeatureFlagName[];
  experimentData: ExperimentData;
  user: Session["user"];
  userBreaches: SubscriberBreach[];
  userScanData: LatestOnerepScanData;
  brokerData: Broker[];
  isEligibleForFreeScan: boolean;
  isEligibleForPremium: boolean;
  monthlySubscriptionUrl: string;
  yearlySubscriptionUrl: string;
  subscriptionBillingAmount: {
    yearly: number;
    monthly: number;
  };
  fxaSettingsUrl: string;
  scanCount: number;
  isNewUser: boolean;
  experimentationId: string;
  hasFirstMonitoringScan: boolean;
  elapsedTimeInDaysSinceInitialScan?: number;
  totalNumberOfPerformedScans?: number;
  activeTab: TabType;
  signInCount: number | null;
};

export type TabData = {
  name: string;
  key: TabType;
};

export const View = (props: Props) => {
  const l10n = useL10n();
  const recordTelemetry = useTelemetry(props.experimentationId);
  const countryCode = useContext(CountryCodeContext);
  const pathname = usePathname();

  const howItWorksFlagEnabled =
    props.enabledFeatureFlags.includes("HowItWorksPage");

  const [activeTab, setActiveTab] = useState<TabType>(props.activeTab);

  useEffect(() => {
    const nextPathname = `/user/dashboard/${activeTab}`;
    if (pathname !== nextPathname) {
      // Directly interacting with the history API is recommended by Next.js to
      // avoid re-rendering on the server:
      // See https://github.com/vercel/next.js/discussions/48110#discussioncomment-7563979.
      window.history.replaceState(null, "", nextPathname);
    }
  }, [pathname, activeTab]);

  const adjustedScanResults = props.userScanData.results.map((scanResult) => {
    if (scanResult.status === "new" && hasPremium(props.user)) {
      // Even if the user has Plus, OneRep won't automatically start removing
      // found exposures; it first sends a request to our webhook, and then the
      // webhook sends an opt-out request to OneRep. Meanwhile, however, we're
      // just waiting for the systems to do their thing, and there's no action
      // for the user to take; hence, we also mark the exposures as being in
      // progress:
      return {
        ...scanResult,
        status: "optout_in_progress",
      } as OnerepScanResultRow;
    }
    return scanResult;
  });
  const adjustedScanData: LatestOnerepScanData = {
    scan: props.userScanData.scan,
    results: adjustedScanResults,
  };

  const initialFilterState: FilterState = {
    exposureType: "show-all-exposure-type",
    dateFound: "show-all-date-found",
  };
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [activeExposureCardKey, setActiveExposureCardKey] = useState<
    string | null
  >(null);
  const tabsData: TabData[] = [
    {
      name: l10n.getString("dashboard-tab-label-action-needed"),
      key: "action-needed",
    },
    {
      name: l10n.getString("dashboard-tab-label-fixed"),
      key: "fixed",
    },
  ];

  const breachesDataArray = props.userBreaches.flat();
  const initialScanInProgress =
    adjustedScanData.scan?.onerep_scan_status === "in_progress" &&
    props.scanCount === 1;

  // Merge exposure cards
  const combinedArray = [...breachesDataArray, ...adjustedScanResults];

  // Sort in descending order
  const arraySortedByDate = combinedArray.sort((a, b) => {
    const dateA =
      (a as SubscriberBreach).addedDate ||
      (a as OnerepScanResultRow).created_at;
    const dateB =
      (b as SubscriberBreach).addedDate ||
      (b as OnerepScanResultRow).created_at;

    const timestampA = dateA.getTime();
    const timestampB = dateB.getTime();

    return timestampB - timestampA;
  });

  const getTabSpecificExposures = (tabKey: TabType) =>
    arraySortedByDate.filter((exposure: Exposure) => {
      const exposureStatus = getExposureStatus(
        exposure,
        props.enabledFeatureFlags.includes("AdditionalRemovalStatuses"),
      );
      return (
        (tabKey === "action-needed" && exposureStatus === "actionNeeded") ||
        (tabKey === "fixed" && exposureStatus !== "actionNeeded")
      );
    });

  const tabSpecificExposures = getTabSpecificExposures(activeTab);
  const filteredExposures = filterExposures(tabSpecificExposures, filters);
  const exposureCardElems = filteredExposures.map((exposure: Exposure) => {
    const exposureCardKey = isScanResult(exposure)
      ? "scan-" + exposure.scan_record_id
      : "breach-" + exposure.id;

    return (
      <li key={exposureCardKey} className={styles.exposureListItem}>
        <ExposureCard
          enabledFeatureFlags={props.enabledFeatureFlags}
          exposureData={exposure}
          isExpanded={exposureCardKey === activeExposureCardKey}
          onToggleExpanded={() => {
            if (exposureCardKey === activeExposureCardKey) {
              setActiveExposureCardKey(null);
              recordTelemetry("collapse", "click", {
                button_id: isScanResult(exposure)
                  ? `data_broker_card_${exposure.scan_record_id}`
                  : `data_breach_card_${exposure.id}`,
              });
            } else {
              setActiveExposureCardKey(exposureCardKey);
              recordTelemetry("expand", "click", {
                button_id: isScanResult(exposure)
                  ? `data_broker_card_${exposure.scan_record_id}`
                  : `data_breach_card_${exposure.id}`,
              });
            }
          }}
          locale={getLocale(l10n)}
          isPremiumUser={hasPremium(props.user)}
          isEligibleForPremium={props.isEligibleForPremium}
          resolutionCta={
            <Button
              variant="primary"
              wide
              href={
                getNextGuidedStep({
                  user: props.user,
                  countryCode,
                  latestScanData: adjustedScanData,
                  subscriberBreaches: props.userBreaches,
                }).href
              }
            >
              {l10n.getString("exposure-card-cta")}
            </Button>
          }
        />
      </li>
    );
  });
  const noUnresolvedExposures = exposureCardElems.length === 0;
  const dataSummary = getDashboardSummary(
    adjustedScanResults,
    props.userBreaches,
  );

  const hasExposures = combinedArray.length > 0;
  const hasUnresolvedBreaches =
    tabSpecificExposures.filter((exposure) => !isScanResult(exposure)).length >
    0;
  const hasUnresolvedBrokers =
    tabSpecificExposures.filter(isScanResult).length > 0;

  const hasUnresolvedExposures = hasUnresolvedBreaches || hasUnresolvedBrokers;
  const hasFixedExposures = hasExposures && !hasUnresolvedExposures;

  const TabContentActionNeeded = () => {
    const {
      dataBreachUnresolvedNum,
      dataBrokerTotalNum,
      dataBrokerAutoFixedNum,
      dataBrokerManuallyResolvedNum,
      dataBrokerInProgressNum,
      dataBreachFixedDataPointsNum,
      dataBrokerAutoFixedDataPointsNum,
      dataBrokerInProgressDataPointsNum,
      dataBrokerManuallyResolvedDataPointsNum,
      totalDataPointsNum,
    } = dataSummary;

    let exposuresAreaDescription;

    if (hasUnresolvedExposures) {
      if (props.isEligibleForPremium) {
        exposuresAreaDescription = l10n.getString(
          "dashboard-exposures-area-description-premium",
          {
            exposures_unresolved_num:
              totalDataPointsNum -
              dataBrokerAutoFixedDataPointsNum -
              dataBreachFixedDataPointsNum -
              dataBrokerInProgressDataPointsNum -
              dataBrokerManuallyResolvedDataPointsNum,
            data_breach_unresolved_num: dataBreachUnresolvedNum,
            data_broker_unresolved_num:
              dataBrokerTotalNum -
              dataBrokerAutoFixedNum -
              dataBrokerManuallyResolvedNum -
              dataBrokerInProgressNum,
          },
        );
      } else {
        exposuresAreaDescription =
          l10n.getString("dashboard-exposures-area-description-all-line1", {
            exposures_unresolved_num:
              totalDataPointsNum -
              dataBrokerAutoFixedDataPointsNum -
              dataBreachFixedDataPointsNum -
              dataBrokerInProgressDataPointsNum -
              dataBrokerManuallyResolvedDataPointsNum,
          }) +
          " " +
          l10n.getString("dashboard-exposures-area-description-all-line2", {
            data_breach_unresolved_num: dataBreachUnresolvedNum,
          });
      }
    }

    if (initialScanInProgress && !noUnresolvedExposures) {
      exposuresAreaDescription = l10n.getString(
        "dashboard-exposures-breaches-scan-progress-description",
        {
          exposures_unresolved_num:
            totalDataPointsNum -
            dataBrokerAutoFixedDataPointsNum -
            dataBreachFixedDataPointsNum -
            dataBrokerInProgressDataPointsNum -
            dataBrokerManuallyResolvedDataPointsNum,
          data_breach_unresolved_num: dataBreachUnresolvedNum,
        },
      );
    } else if (initialScanInProgress) {
      exposuresAreaDescription = l10n.getString(
        "dashboard-exposures-no-breaches-scan-progress-description",
      );
    }

    return (
      <>
        <h2 className={styles.exposuresAreaHeadline}>
          {l10n.getString("dashboard-exposures-area-headline")}
        </h2>
        {exposuresAreaDescription && (
          <p className={styles.exposuresAreaDescription}>
            {exposuresAreaDescription}
          </p>
        )}
      </>
    );
  };

  const TabContentFixed = () => (
    <>
      <h2 className={styles.exposuresAreaHeadline}>
        {l10n.getString(
          props.isEligibleForPremium
            ? "dashboard-fixed-area-headline-premium"
            : "dashboard-fixed-area-headline-all",
        )}
      </h2>
    </>
  );

  const waitlistTriggerRef = useRef<HTMLAnchorElement>(null);
  const dialogTriggerState = useOverlayTriggerState({});
  const overlayTrigger = useOverlayTrigger(
    { type: "dialog" },
    dialogTriggerState,
    waitlistTriggerRef,
  );

  const freeScanCta = props.isEligibleForFreeScan && (
    <>
      <WaitlistDialog
        dialogTriggerState={dialogTriggerState}
        {...overlayTrigger.overlayProps}
      />
      <p>
        {l10n.getFragment("dashboard-exposures-all-fixed-free-scan", {
          vars: {
            data_broker_total_num: CONST_ONEREP_DATA_BROKER_COUNT,
          },
          elems: {
            a:
              typeof props.totalNumberOfPerformedScans === "undefined" ||
              props.totalNumberOfPerformedScans <
                CONST_ONEREP_MAX_SCANS_THRESHOLD ? (
                <a
                  ref={waitlistTriggerRef}
                  href="/user/welcome/free-scan?referrer=dashboard"
                  onClick={() => {
                    recordTelemetry("link", "click", {
                      link_id: "exposures_all_fixed_free_scan",
                    });
                  }}
                />
              ) : (
                <Button
                  variant="link"
                  buttonRef={waitlistTriggerRef}
                  {...overlayTrigger.triggerProps}
                />
              ),
          },
        })}
      </p>
    </>
  );

  const getZeroStateIndicator = () => {
    if (initialScanInProgress) {
      return (
        <>
          <Image src={ScanProgressIllustration} alt="" />
          <strong>
            {l10n.getString("dashboard-exposures-scan-progress-label")}
          </strong>
        </>
      );
    }

    if (!hasUnresolvedExposures && hasFixedExposures) {
      return (
        <>
          <Image src={AllFixedIllustration} alt="" />
          <strong>
            {l10n.getString("dashboard-exposures-all-fixed-label")}
          </strong>
          {freeScanCta}
        </>
      );
    }

    return (
      <>
        <Image src={NoExposuresIllustration} alt="" />
        <strong>{l10n.getString("dashboard-no-exposures-label")}</strong>
        {freeScanCta}
      </>
    );
  };

  return (
    <div className={styles.wrapper}>
      <Toolbar
        user={props.user}
        monthlySubscriptionUrl={props.monthlySubscriptionUrl}
        yearlySubscriptionUrl={props.yearlySubscriptionUrl}
        subscriptionBillingAmount={props.subscriptionBillingAmount}
        fxaSettingsUrl={props.fxaSettingsUrl}
        lastScanDate={props.userScanData.scan?.created_at ?? null}
        experimentData={props.experimentData}
      >
        <TabList
          tabs={tabsData}
          onSelectionChange={(selectedKey) => {
            setActiveTab(selectedKey as TabType);
            recordTelemetry("dashboard", "view", {
              dashboard_tab: selectedKey as TabType,
              legacy_user: !props.isNewUser,
              breach_count: breachesDataArray.length,
              broker_count: adjustedScanResults.length,
            });
          }}
          selectedKey={activeTab}
        />
      </Toolbar>
      {props.experimentData["data-privacy-petition-banner"].enabled &&
        props.isEligibleForPremium &&
        ((activeTab === "fixed" && hasPremium(props.user)) ||
          (activeTab === "action-needed" && !hasPremium(props.user))) && (
          <PetitionBanner user={props.user} />
        )}
      <CsatSurvey
        user={props.user}
        activeTab={activeTab}
        enabledFeatureFlags={props.enabledFeatureFlags}
        experimentData={props.experimentData}
        elapsedTimeInDaysSinceInitialScan={
          props.elapsedTimeInDaysSinceInitialScan ?? null
        }
        hasAutoFixedDataBrokers={
          dataSummary.dataBrokerAutoFixedDataPointsNum > 0
        }
        hasFirstMonitoringScan={props.hasFirstMonitoringScan}
        lastScanDate={props.userScanData.scan?.created_at ?? null}
        signInCount={props.signInCount}
      />
      <div className={styles.dashboardContent}>
        <DashboardTopBanner
          tabType={activeTab}
          scanInProgress={initialScanInProgress}
          isPremiumUser={hasPremium(props.user)}
          isEligibleForPremium={canSubscribeToPremium({
            user: props.user,
            countryCode,
          })}
          isEligibleForFreeScan={props.isEligibleForFreeScan}
          hasExposures={hasExposures}
          hasUnresolvedBreaches={hasUnresolvedBreaches}
          hasUnresolvedBrokers={hasUnresolvedBrokers}
          bannerData={getDashboardSummary(
            adjustedScanResults,
            props.userBreaches,
          )}
          stepDeterminationData={{
            countryCode,
            latestScanData: adjustedScanData,
            subscriberBreaches: props.userBreaches,
            user: props.user,
          }}
          onShowFixed={() => {
            setActiveTab("fixed");
            recordTelemetry("dashboard", "view", {
              dashboard_tab: "fixed",
              legacy_user: !props.isNewUser,
              breach_count: breachesDataArray.length,
              broker_count: adjustedScanResults.length,
            });
          }}
          monthlySubscriptionUrl={props.monthlySubscriptionUrl}
          yearlySubscriptionUrl={props.yearlySubscriptionUrl}
          subscriptionBillingAmount={props.subscriptionBillingAmount}
          totalNumberOfPerformedScans={props.totalNumberOfPerformedScans}
          howItWorksFlagEnabled={howItWorksFlagEnabled}
        />
        <section className={styles.exposuresArea}>
          {activeTab === "action-needed" ? (
            <TabContentActionNeeded />
          ) : (
            <TabContentFixed />
          )}
        </section>
        <div className={styles.exposuresFilterWrapper}>
          <ExposuresFilter
            enabledFeatureFlags={props.enabledFeatureFlags}
            initialFilterValues={initialFilterState}
            filterValues={filters}
            setFilterValues={setFilters}
            isEligibleForPremium={props.isEligibleForPremium}
            isPlusSubscriber={hasPremium(props.user)}
          />
        </div>
        {noUnresolvedExposures ? (
          <div className={styles.zeroStateIndicator}>
            {getZeroStateIndicator()}
          </div>
        ) : (
          <ul className={styles.exposureList}>{exposureCardElems}</ul>
        )}
      </div>
    </div>
  );
};
