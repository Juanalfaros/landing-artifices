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
  const verify = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: token
    })
  }).then((r) => r.json());
  if (!verify.success || verify.score < 0.5)
    return json({ error: "reCAPTCHA failed" }, 403);
  const agente = await nextAgent();
  const brevoHeaders = {
    "api-key": process.env.BREVO_API_KEY,
    "Content-Type": "application/json"
  };
  const attrs = { NOMBRE: name, COMPANY_NAME: company, WEBSITE: website, AGENTE: agente };
  const listIds = [Number(process.env.BREVO_LIST_ID || 6)];
  let res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify({ email, attributes: attrs, listIds, updateEnabled: false })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 400 && err.code === "duplicate_parameter") {
      res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method: "PUT",
        headers: brevoHeaders,
        body: JSON.stringify({ attributes: attrs, listIds })
      });
    }
  }
  if (!res.ok) return json({ error: "Brevo error" }, 502);
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
  const {
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN,
    AGENT_LIST
    // fallback
  } = process.env;
  const rotate = await fetch(
    `${UPSTASH_REDIS_REST_URL}/rpoplpush/agents/agents?_format=json`,
    { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } }
  ).then((r) => r.json()).catch(() => ({}));
  if (rotate.error || rotate.result === null) {
    const agents = AGENT_LIST.split(",").map((a) => a.trim());
    await fetch(
      `${UPSTASH_REDIS_REST_URL}/rpush/agents/${agents.join("/")}?_format=json`,
      { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } }
    );
    return agents[0];
  }
  return rotate.result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=submit-lead.js.map
