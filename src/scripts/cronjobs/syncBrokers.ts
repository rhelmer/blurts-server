/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Cron: Hourly
 * Fetches the list of brokers from HelloPrivacy
 */

import { getDataBrokers } from "../../app/functions/server/helloprivacy";
import {
  upsertBrokers,
  knexBrokers,
} from "../../db/tables/helloprivacy_brokers";

// Fetch broker from brokers API and upserts to DB
const brokers = await getDataBrokers(true, false);
await upsertBrokers(brokers);

await knexBrokers.destroy();
