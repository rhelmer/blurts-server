/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import createDbConnection from "../connect.js";
import { logger } from "../../app/functions/server/logging";

import { ScanRecord, Scan } from "../../app/functions/server/helloprivacy";
import {
  HelloPrivacyScan,
  HelloPrivacyScanRecordsRow,
  HelloPrivacyScanRow,
} from "../../knex-tables.js";

const knex = createDbConnection();

export async function getAllScansForProfile(
  profileId: number,
): Promise<HelloPrivacyScanRow[]> {
  const scans = (await knex("helloprivacy_scans")
    .where("profileId", profileId)
    .orderBy("created_at", "desc")) as HelloPrivacyScanRow;

  return scans;
}

export async function getScanResults(
  brokerScanId: number,
): Promise<HelloPrivacyScanRecordsRow[]> {
  const scanResults = (await knex("helloprivacy_scan_results").where(
    "helloprivacy_scan_id",
    brokerScanId,
  )) as HelloPrivacyScanRecordsRow;
  return scanResults;
}

export async function getLatestScan(
  brokerProfileId: string,
): Promise<HelloPrivacyScanRow | null> {
  const scan = (await knex("helloprivacy_scans")
    .first()
    .where("profile_id", brokerProfileId)
    .orderBy("created_at", "desc")) as HelloPrivacyScanRow;

  return scan ?? null;
}

export async function setHelloPrivacyScan(
  customerId: string,
  scanId: number,
  status: Scan["status"],
) {
  await knex("broker_scans").insert({
    customer_id: customerId,
    broker_scan_id: scanId,
    scan_status: status,
    created_at: knex.fn.now(),
  });

  logger.info("scan_created", {
    helloPrivacyScanId: scanId,
    helloPrivacyScanStatus: status,
  });
}

async function addBrokerScanResults(
  brokerProfileId: number,
  scanRecords: ScanRecord[],
) {
  const scanResultsMap = scanRecords.map((scanRecord) => ({
    broker_scan_result_id: scanRecord.id,
    broker_scan_id: scanRecord.scan_id,
    link: scanRecord.link,
    age:
      typeof scanResult.age === "string"
        ? Number.parseInt(scanResult.age, 10)
        : undefined,
    data_broker: scanResult.data_broker,
    data_broker_id: scanResult.data_broker_id,
    emails: JSON.stringify(scanResult.emails),
    phones: JSON.stringify(scanResult.phones),
    addresses: JSON.stringify(scanResult.addresses),
    relatives: JSON.stringify(scanResult.relatives),
    first_name: scanResult.first_name,
    middle_name: scanResult.middle_name,
    last_name: scanResult.last_name,
    status: scanResult.status,
    optout_attempts: scanResult.optout_attempts,
  }));

  // Only log metadata. This is used for reporting purposes.
  logger.info("scan_result", {
    brokerProfileId,
    scan: scanResultsMap.map((result) => {
      return {
        brokerScanId: result.broker_scan_id,
        brokerScanResultId: result.broker_scan_result_id,
        brokerScanStatus: result.status,
        dataBrokerId: result.data_broker_id,
      };
    }),
  });

  if (scanResultsMap.length > 0) {
    await knex("broker_scan_results")
      .insert(scanResultsMap)
      .onConflict("broker_scan_result_id")
      .merge();
  }
}

export async function isBrokerScanResultForSubscriber(params: {
  brokerScanResultId: number;
  subscriberId: number;
}): Promise<boolean> {
  const result = await knex("broker_scan_results")
    .innerJoin(
      "broker_scans",
      "broker_scan_results.broker_scan_id",
      "broker_scans.broker_scan_id",
    )
    .innerJoin(
      "broker_profiles",
      "broker_scans.broker_profile_id",
      "broker_profiles.broker_profile_id",
    )
    .innerJoin(
      "subscribers",
      "subscribers.id",
      "broker_profiles.monitor_subscriber_id",
    )
    .where(
      "broker_scan_results.broker_scan_result_id",
      params.brokerScanResultId,
    )
    .andWhere("subscribers.id", params.subscriberId)
    .first("broker_scan_result_id");

  return typeof result?.broker_scan_result_id === "number";
}

export async function markBrokerScanResultAsResolved(
  brokerScanResultId: number,
): Promise<void> {
  logger.info("scan_resolved", {
    brokerScanResultId,
  });

  await knex("broker_scan_results")
    .update({
      manually_resolved: true,
      // @ts-ignore knex.fn.now() results in it being set to a date,
      // even if it's not typed as a JS date object:
      updated_at: knex.fn.now(),
    })
    .where("broker_scan_result_id", brokerScanResultId);
}

export async function getScansCount(
  startDate: string,
  endDate: string,
  scanReason: Scan["reason"],
) {
  return await knex("broker_scans")
    .count("id")
    .whereBetween("created_at", [startDate, endDate])
    .andWhere("broker_scan_reason", scanReason);
}

export async function getScansCountForProfile(
  brokerProfileId: number,
): Promise<number> {
  return parseInt(
    ((
      await knex("broker_scans")
        .count("id")
        .where("broker_profile_id", brokerProfileId)
    )?.[0]?.["count"] as string) || "0",
  );
}

export async function deleteScansForProfile(
  brokerProfileId: string,
): Promise<void> {
  await knex("broker_scans")
    .delete()
    .where("broker_profile_id", brokerProfileId);
}

export async function deleteScanResultsForProfile(
  brokerProfileId: number,
): Promise<void> {
  await knex("broker_scan_results")
    .delete()
    .innerJoin(
      "broker_scans",
      "broker_scan_results.broker_scan_id",
      "broker_scans.broker_scan_id",
    )
    .where("broker_profile_id", brokerProfileId);
}
