/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import createDbConnection from "../connect.js";
import { Profile } from "../../app/functions/server/helloprivacy";
import { parseIso8601Datetime } from "../../utils/parse.js";

const knex = createDbConnection();

export async function setHelloPrivacyProfileDetails(
  brokerProfileId: string,
  profileData: Profile,
) {
  const {
    addresses,
    birthMonth,
    birthYear,
    name,
    otherNames,
    emailAddresses,
    phoneNumbers,
  } = profileData;

  const { first, middle, last, suffix } = name;
  const { city, state } = addresses[0];
  const optionalProfileData = {
    ...(typeof middle !== "undefined" && { middle_name: middle }),
    ...(typeof suffix !== "undefined" && { name_suffix: suffix }),
  };

  await knex("broker_profiles").insert({
    broker_profile_id: brokerProfileId,
    first_name: first,
    last_name: last,
    city,
    state,
    birth_month: parseIso8601Datetime(birthMonth),
    birth_year: parseIso8601Datetime(birthYear),
    addresses,
    other_names: otherNames,
    email_addresses: emailAddresses,
    phone_numbers: phoneNumbers,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
    ...optionalProfileData,
  });
}

export async function getProfile(brokerProfileId: string): Promise<Profile> {
  return (await knex("broker_profiles")
    .where("broker_profile_id", brokerProfileId)
    .first()) as Profile;
}

export async function getProfileBySubscriberId(
  subscriberId: string,
): Promise<Profile> {
  return (await knex("broker_profiles")
    .where("monitor_subscriber_id", subscriberId)
    .first()) as Profile;
}

export async function deleteProfileDetails(brokerProfileId: string) {
  await knex("broker_profiles").delete().where({
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
    .select("profile_id")
    .where("monitor_subscriber_id", subscriberId);
  return res?.[0]?.["monitor_subscriber_id"] as string;
}
/* c8 ignore stop */
