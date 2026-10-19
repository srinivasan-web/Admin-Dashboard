import assert from "node:assert/strict";
import test from "node:test";
import { isValidEmail } from "../src/features/auth/emailValidation.ts";

test("accepts an administrator email containing s", () => {
  assert.equal(isValidEmail("sales.manager@example.test"), true);
  assert.equal(isValidEmail("  sales.manager@example.test  "), true);
});

test("rejects malformed addresses without rejecting ordinary letters", () => {
  for (const email of [
    "",
    "userexample.com",
    "user@",
    "user@example",
    "user name@example.com",
    "user@example..com",
  ]) {
    assert.equal(isValidEmail(email), false, email);
  }
});
