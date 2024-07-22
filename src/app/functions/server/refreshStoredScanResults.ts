/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  addOnerepScanResults,
  getAllScansForProfile,
  setOnerepScan,
} from "../../../db/tables/onerep_scans";
import { getAllScanResults, listScans } from "./onerep";
import { logger } from "./logging";
import { getAllScanRecords, getCustomerScans } from "./helloprivacy";
import {
  addHelloPrivacyScanResults,
  getAllScansForCustomer,
  setHelloPrivacyScan,
} from "../../../db/tables/helloprivacy_scans";
import { getSubscriberByOnerepProfileId } from "../../../db/tables/subscribers";

/**
 * Attempt to fetch the current scan results from the provider.
 * If anything is newer, add it to the database.
 *
 * Continue if there are any errors.
 *
 * @param onerepProfileId {number} OneRep Profile ID to refresh.
 */
export async function refreshStoredScanResults(onerepProfileId: number) {
  // FIXME check flag
  if (true) {
    const subscriber = await getSubscriberByOnerepProfileId(onerepProfileId);
    if (!subscriber) {
      return;
    }
    return refreshStoredScanRecords(subscriber.helloprivacy_customer_id);
  }

  try {
    const remoteScans = (await listScans(onerepProfileId)).data;
    const localScans = await getAllScansForProfile(onerepProfileId);

    const newScans = remoteScans.filter(
      (remoteScan) =>
        !localScans.some(
          (localScan) => localScan.onerep_scan_id === remoteScan.id,
        ),
    );

    newScans.forEach((scan) =>
      logger.info("scan_created_or_updated", {
        onerepScanId: scan.id,
        onerepScanStatus: scan.status,
        onerepScanReason: scan.reason,
      }),
    );

    // Record any new scans, or change in existing scan status.
    await Promise.all(
      remoteScans.map(async (scan) => {
        await setOnerepScan(onerepProfileId, scan.id, scan.status, scan.reason);
      }),
    );

    // Refresh results for all scans, new and existing.
    // The database will ignore any attempt to insert duplicate scan result IDs.
    const allScanResults = await getAllScanResults(onerepProfileId);
    await addOnerepScanResults(onerepProfileId, allScanResults);
  } catch (ex) {
    logger.warn("Could not fetch current OneRep results:", ex);
  }
}

/**
 * Attempt to fetch the current scan results from the provider.
 * If anything is newer, add it to the database.
 *
 * Continue if there are any errors.
 *
 * @param customerId {string} HelloPrivacy Customer ID to refresh.
 */
export async function refreshStoredScanRecords(customerId: string) {
  try {
    const remoteScans = await getCustomerScans(customerId);
    const localScans = await getAllScansForCustomer(customerId);

    const newScans = remoteScans.filter(
      (remoteScan) =>
        !localScans.some((localScan) => localScan.scan_id === remoteScan.id),
    );

    newScans.forEach((scan) =>
      logger.info("scan_created_or_updated", {
        helloPrivacyScanId: scan.id,
        helloPrivacyScanStatus: scan.status,
      }),
    );

    // Record any new scans, or change in existing scan status.
    await Promise.all(
      remoteScans.map(async (scan) => {
        await setHelloPrivacyScan(customerId, scan);
      }),
    );

    // Refresh results for all scans, new and existing.
    // The database will ignore any attempt to insert duplicate scan result IDs.
    const allScanResults = await getAllScanRecords(customerId);
    await addHelloPrivacyScanResults(customerId, allScanResults);
  } catch (ex) {
    logger.warn("Could not fetch current HelloPrivacy results:", ex);
  }
}
