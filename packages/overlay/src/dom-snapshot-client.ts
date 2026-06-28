export const domSnapshotClient = `
  const formValueAttributes = new Set(["checked", "selected", "value"]);
  const credentialAttributePattern = /password|passcode|current-password|new-password|one-time-code|otp|token|secret|credential/i;
  const snapshotAttributePrefixes = ["aria-", "data-"];
  const snapshotAttributeNames = new Set(["class", "id", "name", "role", "type"]);

  function domSnapshot(target) {
    if (!target) return "";
    const elements = [target].concat(Array.from(target.querySelectorAll("*")).slice(0, 19));
    return elements.map((element) => snapshotOpeningTag(element)).join("");
  }

  function snapshotOpeningTag(element) {
    const attributes = Array.from(element.attributes)
      .filter((attribute) => shouldIncludeSnapshotAttribute(attribute))
      .map((attribute) => attribute.name + "=\\"" + escapeSnapshotAttribute(attribute.value) + "\\"");
    return "<" + element.tagName.toLowerCase() + (attributes.length > 0 ? " " + attributes.join(" ") : "") + ">";
  }

  function shouldIncludeSnapshotAttribute(attribute) {
    const name = attribute.name.toLowerCase();
    if (formValueAttributes.has(name)) return false;
    if (!isAllowedSnapshotAttribute(name)) return false;
    return !credentialAttributePattern.test(name) && !credentialAttributePattern.test(attribute.value);
  }

  function isAllowedSnapshotAttribute(name) {
    if (snapshotAttributeNames.has(name)) return true;
    return snapshotAttributePrefixes.some((prefix) => name.startsWith(prefix));
  }

  function escapeSnapshotAttribute(value) {
    return value.replaceAll("&", "&amp;").replaceAll("\\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
`;
