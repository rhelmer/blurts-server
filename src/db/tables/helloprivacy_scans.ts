/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import createDbConnection from "../connect.js";
import { logger } from "../../app/functions/server/logging";

import { ScanRecord, Scan } from "../../app/functions/server/helloprivacy";
import {
  HelloPrivacyScan,
  HelloPrivacyScanRecordRow,
  HelloPrivacyScanRow,
} from "../../knex-tables.js";

const knex = createDbConnection();

export async function getAllScansForProfile(
  customerId: string,
): Promise<HelloPrivacyScanRow[]> {
  const scans = (await knex("helloprivacy_scans")
    .where("customerId", customerId)
    .orderBy("created_at", "desc")) as HelloPrivacyScanRow[];

  return scans;
}

export async function getScanResults(
  brokerScanId: number,
): Promise<HelloPrivacyScanRecordRow[]> {
  return (await knex("helloprivacy_scan_results").where(
    "helloprivacy_scan_id",
    brokerScanId,
  )) as HelloPrivacyScanRecordRow[];
}

export async function getLatestScan(
  customerId: string,
): Promise<HelloPrivacyScanRow | null> {
  const scan = (await knex("helloprivacy_scans")
    .first()
    .where("customer_id", customerId)
    .orderBy("created_at", "desc")) as HelloPrivacyScanRow;

  return scan ?? null;
}

export async function setHelloPrivacyScan(
  customerId: string,
  scan: HelloPrivacyScan,
) {
  await knex("helloprivacy_scans").insert({
    scan_id: scan.id,
    status: scan.status,
    customer_id: customerId,
    scan_type: scan.scanType,
    broker_count: scan.brokerCount,
    broker_ids: JSON.stringify(scan.brokerIds),
    realtime: scan.realtime,
    created_at: knex.fn.now(),
  });

  logger.info("helloprivacy_scan_created", {
    helloPrivacyScanId: scan.id,
    helloPrivacyScanStatus: scan.status,
  });
}

export async function addHelloPrivacyScanResults(
  customerId: string,
  scanRecords: ScanRecord[],
) {
  const scanResultsMap = scanRecords.map((scanRecord) => ({
    scan_record_id: scanRecord.id,
    scan_id: scanRecord.scanId,
    broker_id: scanRecord.brokerId,
    customer_id: scanRecord.customerId,
    score: scanRecord.score,
    age: Number.parseInt(scanRecord.age, 10) || null,
    addresses: JSON.stringify(scanRecord.addresses),
    full_name: scanRecord.fullName,
    relatives: JSON.stringify(scanRecord.relatives),
    email_addresses: JSON.stringify(scanRecord.emailAddresses),
    phone_numbers: JSON.stringify(scanRecord.phoneNumbers),
    education: scanRecord.education,
    employment: JSON.stringify(scanRecord.employment),
    gender: scanRecord.gender,
    occupation: scanRecord.occupation,
    property: JSON.stringify(scanRecord.property),
    recordUrl: scanRecord.recordUrl, // FIXME should be record_url
    created_at: scanRecord.createdAt,
    submitted_at: scanRecord.submittedAt,
    confirmed_at: scanRecord.confirmedAt,
    verified_at: scanRecord.verifiedAt,
    modified_at: scanRecord.modifiedAt,
  }));

  // Only log metadata. This is used for reporting purposes.
  logger.info("helloprivacy_scan_records", {
    customerId,
    scan: scanResultsMap.map((result) => {
      return {
        scanId: result.scan_id,
        scanRecordId: result.scan_record_id,
        // FIXME scanStatus: result.status,
        brokerId: result.broker_id,
      };
    }),
  });

  if (scanResultsMap.length > 0) {
    await knex("helloprivacy_scan_records")
      .insert(scanResultsMap)
      .onConflict("scan_record_id")
      .merge();
  }
}

export async function isBrokerScanResultForSubscriber(params: {
  brokerScanResultId: number;
  subscriberId: number;
}): Promise<boolean> {
  const result = await knex("broker_scan_results")
    .innerJoin(
      "helloprivacy_scans",
      "broker_scan_results.broker_scan_id",
      "helloprivacy_scans.broker_scan_id",
    )
    .innerJoin(
      "broker_profiles",
      "helloprivacy_scans.broker_profile_id",
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
  return await knex("helloprivacy_scans")
    .count("id")
    .whereBetween("created_at", [startDate, endDate])
    .andWhere("broker_scan_reason", scanReason);
}

export async function getScansCountForProfile(
  brokerProfileId: number,
): Promise<number> {
  return parseInt(
    ((
      await knex("helloprivacy_scans")
        .count("id")
        .where("broker_profile_id", brokerProfileId)
    )?.[0]?.["count"] as string) || "0",
  );
}

export async function deleteScansForProfile(
  brokerProfileId: string,
): Promise<void> {
  await knex("helloprivacy_scans")
    .delete()
    .where("broker_profile_id", brokerProfileId);
}

export async function deleteScanResultsForProfile(
  brokerProfileId: number,
): Promise<void> {
  await knex("broker_scan_results")
    .delete()
    .innerJoin(
      "helloprivacy_scans",
      "broker_scan_results.broker_scan_id",
      "helloprivacy_scans.broker_scan_id",
    )
    .where("broker_profile_id", brokerProfileId);
}
