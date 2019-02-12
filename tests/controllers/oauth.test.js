"use strict";

const got = require("got");

const AppConstants = require("../../app-constants");
const DB = require("../../db/DB");
const EmailUtils = require("../../email-utils");
const getSha1 = require("../../sha1-utils");
const {init, confirmed} = require("../../controllers/oauth");

require("../resetDB");
const {testBreaches} = require("../test-breaches");


jest.mock("got");


const mockRequest = { fluentFormat: jest.fn() };


test("init request sets session cookie and redirects with access_type=offline", () => {
  mockRequest.session = { };
  mockRequest.query = { };
  const mockResponse = { redirect: jest.fn() };

  init(mockRequest, mockResponse);

  const mockRedirectCallArgs = mockResponse.redirect.mock.calls[0];
  expect(mockRedirectCallArgs[0].href).toMatch(AppConstants.OAUTH_AUTHORIZATION_URI);
  expect(mockRedirectCallArgs[0].href).toMatch("access_type=offline");
});


function getMockRequest(userAddLanguages = "en-US,en;q=0.5") {
  return {
    app: { locals: { breaches: testBreaches } },
    headers: { "accept-language": userAddLanguages },
    fluentFormat: jest.fn(),
    session: { state: { } },
    originalUrl: "",
  };
}


test("confirmed request checks session cookie, calls FXA for token and email, adds new subscriber with signup language, and redirects", async () => {
  const testFxAEmail = "fxa-new-user@test.com";
  const userAddLanguages = "en-US,en;q=0.5";
  EmailUtils.sendEmail = jest.fn();
  // Mock the getToken, got, and render calls
  const mockRequest = getMockRequest(userAddLanguages);
  const mockResponse = { redirect: jest.fn()};
  const mockFxAClient = { code : { getToken: jest.fn().mockReturnValueOnce({ accessToken: "testToken"}) } };
  got.mockResolvedValue({ body: `{"email": "${testFxAEmail}"}` });

  await confirmed(mockRequest, mockResponse, () => {}, mockFxAClient);

  const mockFxACallArgs = mockFxAClient.code.getToken.mock.calls[0];
  expect(mockFxACallArgs[0]).toBe(mockRequest.originalUrl);
  expect(mockFxACallArgs[1]).toEqual({state: mockRequest.session.state});
  const mockGotCallArgs = got.mock.calls[0];
  expect(mockGotCallArgs[0]).toMatch(AppConstants.OAUTH_PROFILE_URI);
  expect(mockGotCallArgs[1].headers.Authorization).toMatch("testToken");

  const subscribers = await DB.getSubscribersByHashes([getSha1(testFxAEmail)]);
  expect(subscribers[0].verified).toBeTruthy();
  expect(subscribers[0].email).toBe(testFxAEmail);
  expect(subscribers[0].signup_language).toBe(userAddLanguages);

  const mockRedirectCallArgs = mockResponse.redirect.mock.calls[0];
  expect(mockRedirectCallArgs[0]).toBe("/scan/user_dashboard");
});


test("confirmed request checks session cookie, calls FXA for token and email, recognizes existing subscriber and redirects", async () => {
  EmailUtils.sendEmail = jest.fn();
  const mockRequest = getMockRequest();
  const mockResponse = { redirect: jest.fn() };
  const mockFxAClient = { code : { getToken: jest.fn().mockReturnValueOnce({ accessToken: "testToken"}) } };

  /* eslint-disable quotes */
  got.mockResolvedValue({ body: `{"email": "firefoxaccount@test.com"}` });
  /*eslint-enable quotes*/

  await confirmed(mockRequest, mockResponse, () => {}, mockFxAClient);

  const mockFxACallArgs = mockFxAClient.code.getToken.mock.calls[0];
  expect(mockFxACallArgs[0]).toBe(mockRequest.originalUrl);
  expect(mockFxACallArgs[1]).toEqual({state: mockRequest.session.state});

  const mockGotCallArgs = got.mock.calls[0];
  expect(mockGotCallArgs[0]).toMatch(AppConstants.OAUTH_PROFILE_URI);
  expect(mockGotCallArgs[1].headers.Authorization).toMatch("testToken");

  const mockRedirectCallArgs = mockResponse.redirect.mock.calls[0];
  expect(mockRedirectCallArgs[0]).toMatch("/");
});


test("confirmed request without session state cookie throws Error", async () => {
  mockRequest.session = {};
  const mockResponse = {};

  await expect(confirmed(mockRequest, mockResponse)).rejects.toThrowError("oauth-invalid-session");
});


test("confirmed request with bad session state cookie throws Error", async () => {
  // Mock request, but don't mock the getToken call to trigger the client-oauth2 error
  mockRequest.session = { state: { } };
  mockRequest.originalUrl = "";
  const mockResponse = {};

  await expect(confirmed(mockRequest, mockResponse)).rejects.toThrow("Invalid state");
});
