/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import createDbConnection from "../connect.js";
import { Broker } from "../../app/functions/server/helloprivacy";
import { HelloPrivacyBrokerRow } from "../../knex-tables.js";

const knex = createDbConnection();

export async function upsertBrokers(brokers: Broker[]) {
  for (const broker of brokers) {
    await knex("helloprivacy_brokers")
      .insert({
        broker_id: broker.id,
        name: broker.name,
        url: broker.url,
        enabled: broker.enabled,
        icon: broker.icon,
        info_types: JSON.stringify(broker.infoTypes),
        estimated_days_to_remove_records: broker.estimatedDaysToRemoveRecords,
        broker_type: broker.brokerType,
        capabilities: JSON.stringify(broker.capabilities),
        removal_instructions: broker.removalInstructions,
        additional_profile_required_fields: JSON.stringify(
          broker.additionalProfileRequiredFields,
        ),
        active_at: broker.activeAt,
        removed_at: broker.removedAt,
      })
      .onConflict("id")
      .merge();
  }
}

export async function getAllBrokers(): Promise<HelloPrivacyBrokerRow[]> {
  const scans = (await knex("helloprivacy_brokers").orderBy(
    "created_at",
    "desc",
  )) as HelloPrivacyBrokerRow[];

  return scans;
}

export async function getBrokerByBrokerId(
  brokerId: number,
): Promise<HelloPrivacyBrokerRow[]> {
  const scans = (await knex("helloprivacy_brokers")
    .where("broker_id", brokerId)
    .orderBy("created_at", "desc")) as HelloPrivacyBrokerRow[];

  return scans;
}

export { knex as knexBrokers };
