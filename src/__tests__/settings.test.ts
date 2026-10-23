it.each([
  [{ aiEnabled: true, geminiKey: "k" }, "gemini"],
  [{ aiEnabled: false, geminiKey: "k" }, "off"],
  [{ aiMode: "device" }, "device"],
])("migrates saved settings %j to mode %s", async (saved, mode) => {
  localStorage.setItem("bodytrace.settings", JSON.stringify(saved));
  vi.resetModules();
  const { getSettings } = await import("../lib/settings");
  expect(getSettings().aiMode).toBe(mode);
  expect(getSettings()).not.toHaveProperty("aiEnabled");
});
