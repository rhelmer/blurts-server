/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export async function up(knex) {
  await knex.schema
    .createTable("helloprivacy_profiles", table => {
      table.increments("id").primary();
      table.integer("monitor_subscriber_id").references("subscribers.id").notNullable();
      table.string("customer_id").unique().notNullable();
      table.string("birth_year").notNullable();
      table.string("birth_month").notNullable();
      table.string("first_name").notNullable();
      table.string("middle_name").nullable();
      table.string("last_name").notNullable();
      table.string("name_suffix").nullable();
      table.string("name_prefix").nullable();
      table.string("city_name").notNullable();
      table.string("state_code").notNullable();
      table.date("date_of_birth").notNullable();
      table.jsonb("other_names");
      table.jsonb("addresses");
      table.jsonb("email_addresses");
      table.jsonb("phone_numbers");
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at");
      table.index("customer_id");
    });

    await knex.schema
    .createTable("helloprivacy_scans", table => {
      table.increments("id").primary();
      table.string("scan_id").unique().notNullable();
      table.string("status").notNullable();
      table.string("customer_id").unique().references("helloprivacy_profiles.customer_id").notNullable();
      table.string("enrollment_id").notNullable();
      table.string("scan_type").notNullable();
      table.integer("broker_count").notNullable();
      table.jsonb("broker_ids").notNullable();
      table.boolean("realtime").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("modified_at");
      table.timestamp("started_at");
      table.timestamp("stopped_at");
      table.index("scan_id");
    });

    await knex.schema
    .createTable("helloprivacy_scan_records", table => {
      table.increments("id").primary();
      table.string("scan_record_id").unique().notNullable();
      table.string("scan_id").references("helloprivacy_scans.scan_id").notNullable();
      table.string("broker_id").notNullable();
      table.string("customer_id").notNullable();
      table.integer("score").notNullable();
      table.integer("age").notNullable();
      table.jsonb("addresses").notNullable();
      table.string("full_name").notNullable();
      table.jsonb("relatives").nullable();
      table.jsonb("email_addresses").nullable();
      table.jsonb("phone_numbers").nullable();
      table.string("education").nullable();
      table.jsonb("employment").nullable();
      table.string("gender").nullable();
      table.jsonb("occupation").nullable();
      table.jsonb("property").nullable();
      table.string("recordUrl").nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("submitted_at");
      table.timestamp("confirmed_at");
      table.timestamp("verified_at");
      table.timestamp("modified_at");
      table.index("scan_record_id");
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  knex.schema.dropTable("helloprivacy_profiles");
  knex.schema.dropTable("helloprivacy_scans");
  knex.schema.dropTable("helloprivacy_scan_records");
}
