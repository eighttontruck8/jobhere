import { cleanup } from "@testing-library/react";
import fc from "fast-check";
import { afterEach } from "vitest";

fc.configureGlobal({ numRuns: 100 });

afterEach(() => {
  cleanup();
});
