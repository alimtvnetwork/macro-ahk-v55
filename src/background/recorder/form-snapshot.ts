import { FormFieldType, TagType } from "../../types/enums";

export interface FormFieldMeta {
    /** First non-empty of: name, id, aria-label, placeholder, fallback `field#N`. */
    readonly Name: string;
    readonly Type: FormFieldType;
    /** Native `name` attribute, when present. Distinct from `Name` (display). */
    readonly NativeName: string | null;
    readonly Id: string | null;
    readonly Required: boolean;
    /** True when masking rules classified this field as sensitive. */
    readonly Sensitive: boolean;
}

export interface FormFieldValue {
    readonly Name: string;
    /**
     * String form of the field value. For checkboxes/radios this is
     * `"true"` / `"false"`. For multi-select this is a JSON array string.
     * For sensitive fields this is masked with `"*"`.
     */
    readonly Value: string;
    readonly Masked: boolean;
}

export interface FormSnapshot {
    /** Identifying info about the form element. */
    readonly Form: {
        readonly Tag: TagType;
        readonly Id: string | null;
        readonly Name: string | null;
        readonly Action: string | null;
        readonly Method: string | null;
    };
    /** Field metadata — ALWAYS present, regardless of Verbose. */
    readonly Fields: ReadonlyArray<FormFieldMeta>;
    /** Field values — populated ONLY when captured with `Verbose: true`. */
    readonly Values: ReadonlyArray<FormFieldValue> | null;
    /** Was this snapshot captured under the verbose toggle? */
    readonly Verbose: boolean;
    /** ISO timestamp at capture time (caller-injectable for determinism). */
    readonly CapturedAt: string;
}

export interface CaptureFormSnapshotOptions {
    readonly Verbose: boolean;
    readonly Now?: () => Date;
}

const SENSITIVE_NAME_RE = /password|secret|token|otp|pin|cvv|ssn|credit/i;
const SENSITIVE_AUTOCOMPLETE = new Set([
  "cc-number", "cc-csc", "one-time-code",
  "current-password", "new-password",
]);

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Captures every form field reachable from `target`'s enclosing
 * `<form>` (or, when `target` is itself a button outside a form, the
 * nearest container with at least one input descendant).
 *
 * Returns `null` when no form-like container can be found — caller
 * should treat the absence as "no snapshot for this step", not an
 * error.
 */
function buildFieldsAndValues(
  elements: readonly Element[],
  verbose: boolean,
): { fields: FormFieldMeta[]; values: FormFieldValue[] } {
  const fields: FormFieldMeta[] = [];
  const values: FormFieldValue[] = [];
  let fallbackIndex = 0;
  for (const element of elements) {
    const meta = readFieldMeta(element, () => `field#${++fallbackIndex}`);
    fields.push(meta);
    if (verbose) {
      values.push(readFieldValue(element, meta));
    }
  }

  return { fields, values };
}

export function captureFormSnapshot(
  target: Element | null,
  options?: CaptureFormSnapshotOptions,
): FormSnapshot | null {
  if (target === null || target === undefined) {
    return null;
  }

  const verbose = options?.Verbose === true;
  const now = options?.Now ?? defaultNow;
  const container = findFormContainer(target);
  if (container === null) {
    return null;
  }

  const elements = collectFormFields(container);
  if (elements.length === 0) {
    return null;
  }

  const { fields, values } = buildFieldsAndValues(elements, verbose);

  return {
    Form: readFormHeader(container),
    Fields: fields,
    Values: verbose ? values : null,
    Verbose: verbose,
    CapturedAt: now().toISOString(),
  };
}

/**
 * Returns true when `target` looks like a submit-style action — used by
 * the recorder to decide whether a `Click` step should also capture a
 * form snapshot.
 */
export function isSubmitTarget(target: Element | null): boolean {
  if (target === null) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  if (tag === "button") {
    const type = (target.getAttribute("type") ?? "submit").toLowerCase();

    return type === "submit";
  }

  if (tag === "input") {
    const type = (target.getAttribute("type") ?? "").toLowerCase();

    return type === "submit" || type === "image";
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Internals                                                          */
/* ------------------------------------------------------------------ */

function findFormContainer(target: Element): Element | null {
  // Prefer a real <form>.
  const form = target.closest("form");
  if (form !== null) {
    return form;
  }

  // Fallback: nearest ancestor with at least one form field descendant.
  // Caps walk at 6 levels so we don't pick up the whole <body>.
  let node: Element | null = target.parentElement;
  let depth = 0;
  while (node !== null && depth < 6) {
    if (node.querySelector("input, textarea, select") !== null) {
      return node;
    }

    node = node.parentElement;
    depth++;
  }

  return null;
}

function collectFormFields(container: Element): Element[] {
  const out: Element[] = [];
  const list = container.querySelectorAll("input, textarea, select");
  for (let i = 0; i < list.length; i++) {
    out.push(list[i]);
  }

  return out;
}

function readFormHeader(container: Element): FormSnapshot["Form"] {
  const isForm = container.tagName.toLowerCase() === "form";

  return {
    Tag: isForm ? "form" : "container",
    Id: nullableAttr(container, "id"),
    Name: nullableAttr(container, "name"),
    Action: isForm ? nullableAttr(container, "action") : null,
    Method: isForm ? (nullableAttr(container, "method")?.toUpperCase() ?? null) : null,
  };
}

function readFieldMeta(element: Element, fallbackName: () => string): FormFieldMeta {
  const tag = element.tagName.toLowerCase();
  const type = inferFieldType(element, tag);
  const nativeName = nullableAttr(element, "name");
  const id = nullableAttr(element, "id");
  const ariaLabel = nullableAttr(element, "aria-label");
  const placeholder = nullableAttr(element, "placeholder");
  const displayName = nativeName ?? id ?? ariaLabel ?? placeholder ?? fallbackName();

  return {
    Name: displayName,
    Type: type,
    NativeName: nativeName,
    Id: id,
    Required: element.hasAttribute("required"),
    Sensitive: classifySensitive(element, type, nativeName, id),
  };
}

function readFieldValue(element: Element, meta: FormFieldMeta): FormFieldValue {
  const raw = readRawValue(element, meta.Type);
  if (meta.Sensitive && raw.length > 0) {
    return { Name: meta.Name, Value: "*".repeat(raw.length), Masked: true };
  }

  return { Name: meta.Name, Value: raw, Masked: false };
}

function readMultiSelectValue(element: Element): string {
  const sel = element as HTMLSelectElement;
  const picked: string[] = [];
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].selected) {
      picked.push(sel.options[i].value);
    }
  }

  return JSON.stringify(picked);
}

function readFileListValue(element: Element): string {
  const files = (element as HTMLInputElement).files;
  if (files === null || files.length === 0) {
    return "";
  }

  const names: string[] = [];
  for (let i = 0; i < files.length; i++) {
    names.push(files[i].name);
  }

  return JSON.stringify(names);
}

function readRawValue(element: Element, type: FormFieldType): string {
  if (type === "checkbox" || type === "radio") {
    return (element as HTMLInputElement).checked === true ? "true" : "false";
  }

  if (type === "select-multiple") {
    return readMultiSelectValue(element);
  }

  if (type === "file") {
    return readFileListValue(element);
  }

  const v = (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

  return typeof v === "string" ? v : "";
}

function inferFieldType(element: Element, tag: string): FormFieldType {
  if (tag === "textarea") {
    return "textarea";
  }

  if (tag === "select") {
    return (element as HTMLSelectElement).multiple ? "select-multiple" : "select";
  }

  const raw = (element.getAttribute("type") ?? "text").toLowerCase();
  const known: ReadonlySet<FormFieldType> = new Set<FormFieldType>([
    "text", "email", "password", "number", "tel", "url", "search",
    "date", "datetime-local", "month", "week", "time", "color", "range",
    "file", "hidden", "checkbox", "radio", "submit", "button",
  ]);

  return known.has(raw as FormFieldType) ? (raw as FormFieldType) : "other";
}

function classifySensitive(
  element: Element,
  type: FormFieldType,
  nativeName: string | null,
  id: string | null,
): boolean {
  if (type === "password") {
    return true;
  }

  const ac = (element.getAttribute("autocomplete") ?? "").toLowerCase();
  if (ac.length > 0) {
    for (const token of ac.split(/\s+/)) {
      if (SENSITIVE_AUTOCOMPLETE.has(token)) {
        return true;
      }
    }
  }

  if (nativeName !== null && SENSITIVE_NAME_RE.test(nativeName)) {
    return true;
  }

  if (id !== null && SENSITIVE_NAME_RE.test(id)) {
    return true;
  }

  return false;
}

function nullableAttr(element: Element, name: string): string | null {
  const v = element.getAttribute(name);
  if (v === null) {
    return null;
  }

  const trimmed = v.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function defaultNow(): Date {
  return new Date();
}
