var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/submit-lead.mjs
var submit_lead_exports = {};
__export(submit_lead_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(submit_lead_exports);
async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    };
  }
  if (event.httpMethod !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }
  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }
  const { name = "", email = "", company = "", website = "", token } = data;
  if (!email || !token) return json({ error: "Missing fields" }, 422);
  if (!process.env.SKIP_RECAPTCHA) {
    const verify = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token
      })
    }).then((r) => r.json());
    if (!verify.success || verify.score < 0.5) {
      return json({ error: "reCAPTCHA failed" }, 403);
    }
  }
  const agente = await nextAgent();
  const brevoHeaders = {
    "api-key": process.env.BREVO_API_KEY,
    "Content-Type": "application/json"
  };
  const attrs = { NOMBRE: name, COMPANY_NAME: company, WEBSITE: website, AGENTE: agente };
  const listIds = [Number(process.env.BREVO_LIST_ID || 6)];
  let brevoRes = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify({ email, attributes: attrs, listIds, updateEnabled: false })
  });
  if (!brevoRes.ok) {
    const err = await brevoRes.json().catch(() => ({}));
    if (brevoRes.status === 400 && err.code === "duplicate_parameter") {
      brevoRes = await fetch(
        `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
        { method: "PUT", headers: brevoHeaders, body: JSON.stringify({ attributes: attrs, listIds }) }
      );
    }
  }
  if (!brevoRes.ok) return json({ error: "Brevo error" }, 502);
  return json({ ok: true, agente });
}
function json(obj, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(obj)
  };
}
async function nextAgent() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, AGENT_LIST } = process.env;
  const agents = AGENT_LIST.split(",").map((a) => a.trim()).filter(Boolean);
  const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };
  const rotateURL = `${UPSTASH_REDIS_REST_URL}/rpoplpush/agents/agents`;
  const res = await fetch(rotateURL, { headers }).then((r) => r.json());
  if (res.error) {
    const initURL = `${UPSTASH_REDIS_REST_URL}/rpush/agents/${agents.join("%20")}`;
    await fetch(initURL, { headers });
    return agents[0];
  }
  return res.result || agents[0];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=submit-lead.js.map
