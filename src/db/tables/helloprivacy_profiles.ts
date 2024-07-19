/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import createDbConnection from "../connect.js";
import { Profile } from "../../app/functions/server/helloprivacy";
import { parseIso8601Datetime } from "../../utils/parse.js";
import { CreateProfileRequest } from "../../app/functions/server/onerep";
import { SubscriberRow } from "knex/types/tables";

const knex = createDbConnection();

export async function setHelloPrivacyProfileDetails(
  subscriberId: number,
  profileId: string,
  profileData: CreateProfileRequest,
) {
  const {
    first_name,
    last_name,
    addresses,
    name_suffix,
    middle_name,
    birth_date,
    phone_numbers,
  } = profileData;

  const { city, state } = addresses[0];
  const optionalProfileData = {
    ...(typeof middle_name !== "undefined" && { middle_name }),
    ...(typeof name_suffix !== "undefined" && { name_suffix }),
  };

  await knex("helloprivacy_profiles").insert({
    monitor_subscriber_id: subscriberId,
    customer_id: profileId,
    first_name,
    last_name,
    city_name: city,
    state_code: state,
    birth_month: birth_date, // FIXME parse
    birth_year: birth_date, // FIXME parse
    date_of_birth: birth_date, // FIXME
    addresses: JSON.stringify(addresses),
    // TODO other_names: otherNames,
    // TODO email_addresses: emailAddresses,
    phone_numbers,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
    ...optionalProfileData,
  });
}

export async function getProfile(brokerProfileId: string): Promise<Profile> {
  return (await knex("helloprivacy_profiles")
    .where("broker_profile_id", brokerProfileId)
    .first()) as Profile;
}

export async function getProfileBySubscriberId(
  subscriberId: string,
): Promise<Profile> {
  const result = await knex("helloprivacy_profiles")
    .where("monitor_subscriber_id", subscriberId)
    .first();
  console.debug(result);
  return result as Profile;
}

export async function deleteProfileDetails(brokerProfileId: string) {
  await knex("helloprivacy_profiles").delete().where({
    broker_profile_id: brokerProfileId,
  });
}

/**
 * @param {number} subscriberId
 * @returns profile ID matching subscriber ID
 */
// Not covered by tests; mostly side-effects. See test-coverage.md#mock-heavy
/* c8 ignore start */
export async function getHelloPrivacyProfileId(
  subscriberId: number,
): Promise<string> {
  const res = await knex("helloprivacy_profiles")
    .select("customer_id")
    .where("monitor_subscriber_id", subscriberId);
  return res?.[0]?.["monitor_subscriber_id"] as string;
}
/* c8 ignore stop */

/**
 * TODO should this be in db/tables/subscribers?
 *
 * @param subscriber
 * @param helloPrivacyCustomerId
 */
export async function setHelloPrivacyCustomerId(
  subscriber: SubscriberRow,
  helloPrivacyCustomerId: string,
) {
  await knex("subscribers").where("id", subscriber.id).update({
    helloprivacy_customer_id: helloPrivacyCustomerId,
    // @ts-ignore knex.fn.now() results in it being set to a date,
    // even if it's not typed as a JS date object:
    updated_at: knex.fn.now(),
  });
}
