/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { Session } from "next-auth";
import { getHelloPrivacyProfileId } from "../../../db/tables/helloprivacy_profiles";
import {
  E164PhoneNumberString,
  ISO8601DateString,
} from "../../../utils/parse.js";
import { StateAbbr } from "../../../utils/states.js";
import { logger } from "./logging";

export type Profile = {
  // Year of birth, in YYYY format.
  birthYear?: string;
  // Month of birth, between 1 and 12
  birthMonth?: string;
  name?: {
    // Honorific prefixes or titles such as Hon, Dr, Mrs, Sir, etc
    prefix?: string;
    // First names, or given names
    first: string;
    // Full middle names or initials
    middle?: string;
    // Surnames, or family names
    last: string;
    // Honorific suffixes, such as Jr or DBE
    suffix?: string;
  };
  otherNames?: [
    {
      // Honorific prefixes or titles such as Hon, Dr, Mrs, Sir, etc
      prefix?: string;
      // First names, or given names
      first: string;
      // Full middle names or initials
      middle?: string;
      // Surnames, or family names
      last: string;
      // Honorific suffixes, such as Jr or DBE
      suffix?: string;
    },
  ];
  addresses: [
    {
      // First line of the street address. Required if country is "GB"
      address1?: string;
      // Second line of the street address
      address2?: string;
      // Name of the city or locality
      city: string;
      // The state, provincial, or territorial subdivision of the ISO-3166 code as appropriate for the country. Required if country is "AU", "CA", or "US"
      state: StateAbbr;
      // Postal code (required for non-US Addresses)
      postalCode?: string;
      // ISO-3166 country code
      country?: string;
      // Whether the person lives here now
      current?: boolean;
    },
  ];
  // List of email addresses. See RFC 5322 § 3.4.1 addr-spec.
  emailAddresses?: [string];
  // List of phone numbers. See E.164.
  phoneNumbers?: [E164PhoneNumberString];
};

export type CreateScanRequest = Profile & {
  // The cross-reference ID provided with a Scan or Enrollment. Customer IDs can include any
  // printable ASCII characters except: ()<>"';
  customerId: string;
  // Whether scan callbacks emit in "real-time" as it processes (deltas). If set to false, the system will wait until the scan completes before emitting a callback.
  realtime?: boolean;
  // The name of the scan's subscription plan. Defaults to "standard"
  scanType?: string;
  // In the sandbox environment, this determines which brokers in this scan (or all related scans, when creating an enrollment) will return results. Defaults to "random"
  desiredResults?: string;
  // In the sandbox environment, this determines which brokers in this scan (or all related scans, when creating an enrollment) will simulate a "retry" condition. Defaults to "none"
  desiredRetries?: string;
};

export type CreateScanResponse = Scan & {
  // ID referring to a Scan object
  id: string;
  // ID referring to an Enrollment object
  enrollmentId: string | null;
  // The name of the scan's subscription plan. Defaults to "standard"
  scanType: string;
  // The total number of data brokers covered by this Scan.
  brokerCount: number;
  // A list of brokers to be searched for this scan.
  brokerIds: [string];
  // Indicates whether this scan posts delta callbacks "in real-time" or a single callback when the scan completes.
  // Defaults to `false`
  realtime: boolean;
  // When we created this Scan object and queued it. See ISO 8601 "Zulu Time".
  createdAt: ISO8601DateString;
  // When we last modified direct properties of this Scan object. See ISO 8601 "Zulu Time".
  modifiedAt: ISO8601DateString;
  // When this scan began executing (popped from the queue). See ISO 8601 "Zulu Time".
  startedAt: ISO8601DateString;
  // When this scan stopped executing (all brokers scanned). See ISO 8601 "Zulu Time".
  stoppedAT: ISO8601DateString;
};

export type Enrollment = {
  // ID referring to an Enrollment object
  id: string;
  // The cross-reference ID provided with a Scan or Enrollment. Customer IDs can include any
  // printable ASCII characters except: ()<>"';
  customerId: string;
  // The name of the enrollment's subscription Plan. Defaults to "standard".
  enrollmentType?: string;

  // When we last modified direct properties of this Scan object. See ISO 8601 "Zulu Time".
  modifiedAt: ISO8601DateString;
  // When we created this Scan object and queued it. See ISO 8601 "Zulu Time".
  createdAt: ISO8601DateString;
  // When the enrollment was canceled. See ISO 8601 "Zulu Time".
  canceledAt: ISO8601DateString;
  // When the enrollment's next scan is scheduled. See ISO 8601 "Zulu Time".
  rescanAt: ISO8601DateString;
};

export type Scan = {
  id: number;
  customerId: number;
  status: "created" | "queued" | "active" | "done";
};

export type ScanRecord = {
  id: string;
  // ID referring to a Scan object
  scanId: string;
  // ID referring to a specific Broker object
  brokerId: string;
  // The cross-reference ID provided with a Scan or Enrollment. Customer IDs can include any
  // printable ASCII characters except: ()<>"';
  customerId: string;
  // Relevance score based on the matching algorithm, between 0 and 100
  score: number;
  // When the record was created. See ISO 8601 "Zulu Time".
  createdAt: ISO8601DateString;
  // When the removal request was submitted to the broker site. See ISO 8601 "Zulu Time".
  submittedAt: ISO8601DateString | null;
  // When the removal request was confirmed. See ISO 8601 "Zulu Time".
  confirmedAt: ISO8601DateString | null;
  // When the record's removal from the broker site was verified. See ISO 8601 "Zulu Time".
  verifiedAt: ISO8601DateString | null;
  // When the record was last edited. See ISO 8601 "Zulu Time".
  modifiedAt: ISO8601DateString;
  // A single number for the age, a range like "40-45", "available", or an empty string
  age: string;
  addresses: [string];
  fullName: string;
  relatives: [string];
  phoneNumbers: [E164PhoneNumberString];
  emailAddresses: [string];
  education: string;
  employment: [string];
  gender: string;
  occupation: string;
  property: [string];
  // A link to the record if enabled (blank if not available)
  recordUrl: string;
};

export type Customer = {
  // The cross-reference ID provided with a Scan or Enrollment. Customer IDs can include any
  // printable ASCII characters except: ()<>"';
  id: string;
  // The actions this customer needs to take.
  requiredActions: string;
  // When the customer was added. See ISO 8601 "Zulu Time".
  createdAt: ISO8601DateString;
  // When the customer was last edited. See ISO 8601 "Zulu Time".
  modifiedAt: ISO8601DateString;
};

export type BrokerFamily = {
  // ID referring to a specific Broker Family object
  id?: string;
  // The name of the broker family
  name: string;
  // The id of the parent broker for this family
  parentBrokerId: string;
  // The broker IDs belonging to the broker family
  brokerIds: [string];
  // Key value pair representing a broker family's removal instructions
  removalInstructions: {
    // Step by step guide for removing end user information in markdown text
    removalSteps: string | null;
    // The link to remove
    removalURL: string | null;
    // An email to connect with data broker support in case of any issues
    supportEmail: string | null;
    // Details on what to do if the information will not be removed
    notGettingRemoved: string | null;
    // When we last modified direct properties of this BrokerFamilyRemovalInstructions object. See ISO 8601 "Zulu Time".
    lastModifiedDate: ISO8601DateString | null;
  };
  // When the record was created. See ISO 8601 "Zulu Time".
  createdAt: ISO8601DateString;
  // When the record was last edited. See ISO 8601 "Zulu Time".
  modifiedAt: ISO8601DateString;
};

export type Broker = {
  // ID referring to a specific Broker object
  id: string;
  name: string;
  url: string;
  // Whether or not this broker is enabled for the client. Disabled
  // brokers will not be scanned for records
  enabled: boolean;
  // The Base64-encoded PNG "fav icon" for the specified broker. If no icon is available, a null
  // value will be returned.
  icon: string | null;
  // A list of information types the broker may have available,
  // including those behind a paywall.
  infoTypes: string[];
  // The number of days it typically takes this broker to remove a record after it has been submitted.
  estimatedDaysToRemoveRecords: number;
  // When the broker was added to the api. See ISO 8601 "Zulu Time".
  activeAt: ISO8601DateString;
  // When the broker was removed from the api. See ISO 8601 "Zulu Time".
  removedAt: ISO8601DateString;
  // Defines the type of broker.
  // `Scan Only` `Removal Only` `Scan & Verify` `Scan & Removal`
  brokerType: string;
  // The functionality that the broker enables for the purposes of automation.
  capabilities: {
    // Whether or not the broker supports searches
    allowsSearch: boolean;
    // Whether or not the broker supports opt-outs
    allowsOptOut: boolean;
    // Whether or not the broker supports verifications
    allowsVerify: boolean;
  };
  // Describes how to remove a record from a Scan Only broker.
  // Markdown format.
  removalInstructions: string;
  // Notes any optional profile fields that are required by an individual broker.
  // If these fields are not provided in the profile data, the broker cannot be scanned.
  // This field is omitted from the response data unless specifically requested.
  additionalProfileRequiredFields: [];
};

/**
 * Determine if the current user is eligible for a free scan.
 *
 * @param user
 * @param countryCode
 */
export async function isEligibleForFreeScan(
  user: Session["user"],
  countryCode: string,
): Promise<boolean> {
  if (countryCode !== "us") {
    return false;
  }

  if (!user?.subscriber?.id) {
    throw new Error("No session with a known subscriber found");
  }

  const profileId = await getHelloPrivacyProfileId(user.subscriber.id);
  const scanResult = await getLatestScanResults(profileId);

  if (scanResult.scan) {
    logger.warn("User has already used free scan");
    return false;
  }

  return true;
}

/**
 * Determine if the current user is eligible to upgrade to Plus.
 *
 * @param countryCode
 */
export function isEligibleForPlus(countryCode: string): boolean {
  return countryCode === "us";
}

/**
 * A wrapper around `fetch` to handle authentication and error checking.
 *
 * @param path - path to API from base URL
 * @param options - options are passed to `fetch`
 */
async function internalFetch(
  path: string,
  options: Parameters<typeof fetch>[1] = {},
): Promise<JSON> {
  const helloPrivacyApiBase = process.env.HELLOPRIVACY_API_BASE;
  if (!helloPrivacyApiBase) {
    throw new Error("HELLOPRIVACY_API_BASE env var not set");
  }
  const helloPrivacyApiKey = process.env.HELLOPRIVACY_API_KEY;
  if (!helloPrivacyApiKey) {
    throw new Error("HELLOPRIVACY_API_KEY env var not set");
  }
  const url = new URL(path, helloPrivacyApiBase);
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${helloPrivacyApiKey}`);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    logger.error(
      `Failed calling HelloPrivacy API: [${response.status}] [${response.statusText}]`,
    );
    throw new Error(
      `Failed calling HelloPrivacy API: [${response.status}] [${response.statusText}]`,
    );
  }
  return response.json() as unknown as JSON;
}

/**
 * Enqueue a private info scan.
 * As scans complete, we will send a callback to the configured
 * endpoint. For a realtime scan, we will send several event-triggered
 * callbacks containing deltas. Otherwise, the system will wait until the
 * scan completes to trigger a callback.
 *
 * @param customerId
 * @param profile
 *
 * @see https://docs.array.com/v1.0/reference/createscan
 */
export async function createScan(
  customerId: string,
  profile: Profile,
): Promise<CreateScanResponse> {
  return (await internalFetch(`/v1/scans`, {
    method: "POST",
    body: JSON.stringify({ customerId, profile }),
  })) as unknown as Promise<CreateScanResponse>;
}

/**
 * Use this endpoint to trigger removal of an existing scan's PII.
 *
 * @param id - the unique ID for a scan
 */
export async function deleteScan(id: string): Promise<JSON> {
  return await internalFetch(`/v1/scans/id/${id}`);
}

/**
 * Enroll a customer in ongoing private info removal.
 *
 * @param customerId - The cross-reference ID provided with a Scan or Enrollment. Customer IDs can include any
 * printable ASCII characters except: ()<>"';
 * @param profile - The user's personal information.
 * @param enrollmentType - The name of the enrollment's subscription Plan. Defaults to "standard".
 * @param desiredResults - In the sandbox environment, this determines which brokers in this scan
 * (or all related scans, when creating an enrollment) will return results.
 * @param desiredRetries - In the sandbox environment, this determines which brokers in this scan
 * (or all related scans, when creating an enrollment) will simulate a "retry" ondition.
 * @param desiredVerifications - In the sandbox environment, this determines which brokers will verify results for the related enrollment scans.
 */
export async function createEnrollment(
  customerId: string,
  profile: Profile,
  desiredVerifications: string,
  enrollmentType?: string,
  desiredResults?: string,
  desiredRetries?: string,
): Promise<Enrollment> {
  return (await internalFetch(`/v1/enrollments`, {
    method: "POST",
    body: JSON.stringify({
      customerId,
      profile,
      enrollmentType,
      desiredResults,
      desiredRetries,
      desiredVerifications,
    }),
  })) as unknown as Enrollment;
}

/**
 * Performs a shallow update of the enrollment object.
 * For example, if you want to update any part of the profile attribute,
 * you must pass the entire profile object.
 *
 * @param id - the unique ID for the enrollment
 * @param profile - The user's personal information.
 */
export async function updateEnrollment(
  id: string,
  profile: Profile,
): Promise<undefined> {
  await internalFetch(`/v1/enrollments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ profile }),
  });
}

/**
 * Cancel an enrollment.
 *
 * @param id - the unique ID for the enrollment
 * @returns customerId
 */
export async function cancelEnrollment(id: string): Promise<JSON> {
  return await internalFetch(`/v1/enrollments/${id}`, {
    method: "DELETE",
  });
}

/**
 * Use this endpoint to trigger removal of an existing enrollment's PII.
 * WARNING: This may result in orphaned records that can no longer be remediated.
 * The Cancel Enrollment endpoint is preferred, as it will only delete this information once all records have been remediated.
 *
 * @param id - the unique ID for the enrollment
 * @returns customerId
 */
export async function deleteEnrollment(id: string): Promise<JSON> {
  return await internalFetch(`/v1/enrollments/${id}`, {
    method: "POST",
  });
}

/**
 * Get the status of a scan.
 *
 * @param id - the unique ID for a scan
 */
export async function getScan(id: string): Promise<CreateScanResponse> {
  return (await internalFetch(
    `/v1/scans/${id}`,
  )) as unknown as CreateScanResponse;
}

/**
 * Get all records matched by a specific scan.
 *
 * @param id - the unique ID for a scan
 */
export async function getScanRecords(id: string): Promise<ScanRecord[]> {
  return (await internalFetch(
    `/v1/scans/${id}/records`,
  )) as unknown as ScanRecord[];
}

/**
 * Get all records matched by a specific scan.
 *
 * @param id - the unique ID for a scan
 */
export async function getBrokerScans(id: string): Promise<Scan[]> {
  return (await internalFetch(
    `/v1/scans/${id}/brokerScans`,
  )) as unknown as Scan[];
}

/**
 * Get the status of a customer.
 *
 * @param id - The unique ID for a customer
 */
export async function getCustomer(id: string): Promise<Customer> {
  return (await internalFetch(`/v1/customers/${id}`)) as unknown as Customer;
}

/**
 * Get all scans belonging to a specific customer
 *
 * @param id - The unique ID for a customer
 */
export async function getCustomerScans(id: string): Promise<Scan[]> {
  return (await internalFetch(
    `/v1/customers/${id}/scans`,
  )) as unknown as Scan[];
}

/**
 * Get all Enrollments belonging to a specific customer
 *
 * @param id - The unique ID for a customer
 */
export async function getCustomerEnrollments(
  id: string,
): Promise<Enrollment[]> {
  return (await internalFetch(
    `/v1/customers/${id}/enrollments`,
  )) as unknown as Enrollment[];
}

/**
 * Get the status of an enrollment.
 *
 * @param id - the unique ID for the enrollment
 */
export async function getEnrollment(id: string): Promise<Enrollment> {
  return (await internalFetch(
    `/v1/enrollments/${id}`,
  )) as unknown as Enrollment;
}

/**
 * Get scans belonging to an enrollment
 *
 * @param id - the unique ID for the enrollment
 */
export async function getEnrollmentScans(id: string): Promise<Scan[]> {
  return (await internalFetch(
    `/v1/enrollments/${id}/scans`,
  )) as unknown as Scan[];
}

/**
 * Get the list of data brokers for all plans associated with your client.
 *
 * @param includeIcons - Set to true to include a Base64-encoded image/png icon for each broker as part of the request.
 * Since these icons can inflate the size of the response significantly, the default value is
 * false.
 * @param includeRequiredFields - Set to true to include the additional required fields for each broker as part of the request.
 * Defaults to false
 */
export async function getDataBrokers(
  includeIcons?: boolean,
  includeRequiredFields?: boolean,
): Promise<Broker[]> {
  return (await internalFetch(
    `/v1/brokers/?includeIcons=${includeIcons}&includeRequiredFields=${includeRequiredFields}`,
  )) as unknown as Broker[];
}

/**
 * Get a specific broker by the broker's ID
 *
 * @param id - The unique ID for a Broker
 */
export async function getBroker(id: string): Promise<Broker> {
  return (await internalFetch(`/v1/brokers/${id}`)) as unknown as Broker;
}

/**
 * Get the full list of broker families. A broker family will only
 * include brokers ids that are active for the client's plans.
 */
export async function getBrokerFamilies(): Promise<BrokerFamily[]> {
  return (await internalFetch(
    `/v1/brokerFamilies`,
  )) as unknown as BrokerFamily[];
}
