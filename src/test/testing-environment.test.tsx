import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PlaceholderPage } from "@/components/placeholder-page";

describe("test environment", () => {
  it("renders a React component in jsdom", () => {
    render(
      <PlaceholderPage
        eyebrow="Test"
        title="테스트 환경"
        description="Vitest가 React 컴포넌트를 렌더링합니다."
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "테스트 환경" }),
    ).toBeTruthy();
  });

  it("runs fast-check properties with the shared configuration", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(value.normalize()).toBe(value.normalize().normalize());
      }),
    );
  });
});
