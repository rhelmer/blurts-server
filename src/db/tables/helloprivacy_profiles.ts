/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import createDbConnection from "../connect.js";
import { Profile } from "../../app/functions/server/helloprivacy";
import { CreateProfileRequest } from "../../app/functions/server/onerep";
import { HelloPrivacyProfileRow } from "../../knex-tables.js";

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

export async function getProfile(
  customerId: string,
): Promise<HelloPrivacyProfileRow> {
  return (await knex("helloprivacy_profiles")
    .where("customer_id", customerId)
    .first()) as HelloPrivacyProfileRow;
}

export async function deleteProfileDetails(customerId: string) {
  await knex("helloprivacy_profiles").delete().where({
    customer_id: customerId,
  });
}
