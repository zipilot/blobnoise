import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { BlobNoise } from "./index";

it("renders only canvas markup on the server without browser globals", () => {
  expect(typeof document).toBe("undefined");
  expect(renderToString(createElement(BlobNoise, {
    config: {},
    className: "design",
    style: { width: 128, height: 128 },
    "aria-label": "Animated material",
  }))).toContain('<canvas class="design" style="width:128px;height:128px" aria-label="Animated material">');
});
