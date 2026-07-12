// validate-args.mjs — the one arg validator both the future unified
// dispatcher (harness-integration-2, bee.mjs) and the extended
// bee-write-guard.mjs (harness-integration-3) import. Given a command-registry
// entry and a parsed-args object, decide whether the call is well-formed
// against the entry's JSON-Schema `parameters` — before anything dispatches
// or executes. Never throws: always returns a structured result.

/**
 * Structural check that a `parameters` value is JSON-Schema in the exact
 * shape D3 requires: {type:"object", properties, required}, every `required`
 * name present in `properties`, every property carrying a `type`.
 */
export function isValidParameterSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
  if (schema.type !== 'object') return false;
  if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
    return false;
  }
  if (!Array.isArray(schema.required)) return false;
  for (const field of schema.required) {
    if (typeof field !== 'string' || !Object.prototype.hasOwnProperty.call(schema.properties, field)) {
      return false;
    }
  }
  for (const propSchema of Object.values(schema.properties)) {
    if (!propSchema || typeof propSchema.type !== 'string') return false;
  }
  return true;
}

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

// CLI flags arrive as strings (argv parsing never produces real booleans or
// numbers) - a schema of type "boolean"/"number" must still accept the CLI's
// own string encoding of them, not just a native JS boolean/number.
function typeMatches(jsonType, value) {
  switch (jsonType) {
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean' || value === 'true' || value === 'false';
    case 'number':
    case 'integer':
      if (typeof value === 'number') return Number.isFinite(value);
      return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
    case 'array':
      return Array.isArray(value) || typeof value === 'string'; // comma-separated CLI convention
    default:
      return true;
  }
}

/**
 * Validate parsedArgs against a command registry entry's parameters schema.
 * @param {object} commandEntry - a COMMAND_REGISTRY entry (needs .name, .parameters)
 * @param {object} parsedArgs - flag name -> value (as parsed from argv)
 * @returns {{ok:true}|{ok:false, error:{field:string|null, reason:string, command:string|null}}}
 */
export function validate(commandEntry, parsedArgs = {}) {
  const command = commandEntry && typeof commandEntry.name === 'string' ? commandEntry.name : null;
  const schema = commandEntry && commandEntry.parameters;
  const args = parsedArgs && typeof parsedArgs === 'object' ? parsedArgs : {};

  if (!isValidParameterSchema(schema)) {
    return {
      ok: false,
      error: { field: null, reason: 'command has no valid JSON-Schema parameters', command },
    };
  }

  for (const field of schema.required) {
    if (!isPresent(args[field])) {
      return { ok: false, error: { field, reason: 'required, missing', command } };
    }
  }

  for (const [field, value] of Object.entries(args)) {
    if (value === undefined) continue;
    const propSchema = schema.properties[field];
    if (!propSchema) continue; // unknown-flag rejection is the dispatcher/hook's own concern
    if (!typeMatches(propSchema.type, value)) {
      return {
        ok: false,
        error: { field, reason: `invalid type, expected ${propSchema.type}`, command },
      };
    }
  }

  return { ok: true };
}
