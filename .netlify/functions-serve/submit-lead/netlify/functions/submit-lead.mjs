
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/submit-lead.js
import fetch from "node-fetch";
var submit_lead_default = async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const data = await req.json();
  const secret = context.env.RECAPTCHA_SECRET;
  const verify = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: data.token,
        remoteip: req.headers.get("x-nf-client-connection-ip") || ""
      })
    }
  ).then((r) => r.json());
  if (!verify.success || verify.score < 0.5) {
    return new Response("reCAPTCHA failed", { status: 403 });
  }
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${context.env.SENDGRID_API_KEY}`
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: context.env.TO_EMAIL }] }],
      from: { email: context.env.FROM_EMAIL },
      subject: "Nuevo lead landing\u2011artifices",
      content: [
        {
          type: "text/plain",
          value: `
Nombre:  ${data.name}
Email:   ${data.email}
Tel\xE9fono:${data.phone}
Mensaje: ${data.message}`
        }
      ]
    })
  });
  if (!resp.ok) {
    return new Response("Mail provider error", { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
export {
  submit_lead_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvc3VibWl0LWxlYWQuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIG5ldGxpZnkvZnVuY3Rpb25zL3N1Ym1pdC1sZWFkLmpzXG5pbXBvcnQgZmV0Y2ggZnJvbSAnbm9kZS1mZXRjaCc7XG5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIChyZXEsIGNvbnRleHQpID0+IHtcbiAgLy8gMSkgU29sbyBQT1NUXG4gIGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKCdNZXRob2QgTm90IEFsbG93ZWQnLCB7IHN0YXR1czogNDA1IH0pO1xuICB9XG5cbiAgLyoqIDIpIEJvZHkgZXNwZXJhZG9cbiAgICogeyBuYW1lLCBlbWFpbCwgcGhvbmUsIG1lc3NhZ2UsIHRva2VuIH1cbiAgICovXG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXEuanNvbigpO1xuXG4gIC8vIDMpIFZlcmlmaWNhIHJlQ0FQVENIQSB2M1xuICBjb25zdCBzZWNyZXQgPSBjb250ZXh0LmVudi5SRUNBUFRDSEFfU0VDUkVUO1xuICBjb25zdCB2ZXJpZnkgPSBhd2FpdCBmZXRjaChcbiAgICAnaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9yZWNhcHRjaGEvYXBpL3NpdGV2ZXJpZnknLFxuICAgIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcgfSxcbiAgICAgIGJvZHk6IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgICBzZWNyZXQsXG4gICAgICAgIHJlc3BvbnNlOiBkYXRhLnRva2VuLFxuICAgICAgICByZW1vdGVpcDogcmVxLmhlYWRlcnMuZ2V0KCd4LW5mLWNsaWVudC1jb25uZWN0aW9uLWlwJykgfHwgJydcbiAgICAgIH0pXG4gICAgfVxuICApLnRoZW4ociA9PiByLmpzb24oKSk7XG5cbiAgaWYgKCF2ZXJpZnkuc3VjY2VzcyB8fCB2ZXJpZnkuc2NvcmUgPCAwLjUpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKCdyZUNBUFRDSEEgZmFpbGVkJywgeyBzdGF0dXM6IDQwMyB9KTtcbiAgfVxuXG4gIC8vIDQpIEFxdVx1MDBFRCBlbnZcdTAwRURhcyBlbCBsZWFkXHUyMDI2XG4gIC8vIEVqZW1wbG86IEVtYWlsIGNvbiBTZW5kR3JpZCAobyBndWFyZGEgZW4gQWlydGFibGUsIGV0Yy4pXG4gIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9hcGkuc2VuZGdyaWQuY29tL3YzL21haWwvc2VuZCcsIHtcbiAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke2NvbnRleHQuZW52LlNFTkRHUklEX0FQSV9LRVl9YFxuICAgIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgcGVyc29uYWxpemF0aW9uczogW3sgdG86IFt7IGVtYWlsOiBjb250ZXh0LmVudi5UT19FTUFJTCB9XSB9XSxcbiAgICAgIGZyb206IHsgZW1haWw6IGNvbnRleHQuZW52LkZST01fRU1BSUwgfSxcbiAgICAgIHN1YmplY3Q6ICdOdWV2byBsZWFkIGxhbmRpbmdcdTIwMTFhcnRpZmljZXMnLFxuICAgICAgY29udGVudDogW1xuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogJ3RleHQvcGxhaW4nLFxuICAgICAgICAgIHZhbHVlOiBgXG5Ob21icmU6ICAke2RhdGEubmFtZX1cbkVtYWlsOiAgICR7ZGF0YS5lbWFpbH1cblRlbFx1MDBFOWZvbm86JHtkYXRhLnBob25lfVxuTWVuc2FqZTogJHtkYXRhLm1lc3NhZ2V9YFxuICAgICAgICB9XG4gICAgICBdXG4gICAgfSlcbiAgfSk7XG5cbiAgaWYgKCFyZXNwLm9rKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZSgnTWFpbCBwcm92aWRlciBlcnJvcicsIHsgc3RhdHVzOiA1MDIgfSk7XG4gIH1cblxuICAvLyA1KSBSZXNwdWVzdGEgT0tcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IG9rOiB0cnVlIH0pLCB7XG4gICAgc3RhdHVzOiAyMDAsXG4gICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgfSk7XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUNBLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLE9BQU8sS0FBSyxZQUFZO0FBRXJDLE1BQUksSUFBSSxXQUFXLFFBQVE7QUFDekIsV0FBTyxJQUFJLFNBQVMsc0JBQXNCLEVBQUUsUUFBUSxJQUFJLENBQUM7QUFBQSxFQUMzRDtBQUtBLFFBQU0sT0FBTyxNQUFNLElBQUksS0FBSztBQUc1QixRQUFNLFNBQVMsUUFBUSxJQUFJO0FBQzNCLFFBQU0sU0FBUyxNQUFNO0FBQUEsSUFDbkI7QUFBQSxJQUNBO0FBQUEsTUFDRSxRQUFRO0FBQUEsTUFDUixTQUFTLEVBQUUsZ0JBQWdCLG9DQUFvQztBQUFBLE1BQy9ELE1BQU0sSUFBSSxnQkFBZ0I7QUFBQSxRQUN4QjtBQUFBLFFBQ0EsVUFBVSxLQUFLO0FBQUEsUUFDZixVQUFVLElBQUksUUFBUSxJQUFJLDJCQUEyQixLQUFLO0FBQUEsTUFDNUQsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGLEVBQUUsS0FBSyxPQUFLLEVBQUUsS0FBSyxDQUFDO0FBRXBCLE1BQUksQ0FBQyxPQUFPLFdBQVcsT0FBTyxRQUFRLEtBQUs7QUFDekMsV0FBTyxJQUFJLFNBQVMsb0JBQW9CLEVBQUUsUUFBUSxJQUFJLENBQUM7QUFBQSxFQUN6RDtBQUlBLFFBQU0sT0FBTyxNQUFNLE1BQU0seUNBQXlDO0FBQUEsSUFDaEUsUUFBUTtBQUFBLElBQ1IsU0FBUztBQUFBLE1BQ1AsZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZSxVQUFVLFFBQVEsSUFBSSxnQkFBZ0I7QUFBQSxJQUN2RDtBQUFBLElBQ0EsTUFBTSxLQUFLLFVBQVU7QUFBQSxNQUNuQixrQkFBa0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLE9BQU8sUUFBUSxJQUFJLFNBQVMsQ0FBQyxFQUFFLENBQUM7QUFBQSxNQUM1RCxNQUFNLEVBQUUsT0FBTyxRQUFRLElBQUksV0FBVztBQUFBLE1BQ3RDLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxRQUNQO0FBQUEsVUFDRSxNQUFNO0FBQUEsVUFDTixPQUFPO0FBQUEsV0FDTixLQUFLLElBQUk7QUFBQSxXQUNULEtBQUssS0FBSztBQUFBLGNBQ1YsS0FBSyxLQUFLO0FBQUEsV0FDVixLQUFLLE9BQU87QUFBQSxRQUNmO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUVELE1BQUksQ0FBQyxLQUFLLElBQUk7QUFDWixXQUFPLElBQUksU0FBUyx1QkFBdUIsRUFBRSxRQUFRLElBQUksQ0FBQztBQUFBLEVBQzVEO0FBR0EsU0FBTyxJQUFJLFNBQVMsS0FBSyxVQUFVLEVBQUUsSUFBSSxLQUFLLENBQUMsR0FBRztBQUFBLElBQ2hELFFBQVE7QUFBQSxJQUNSLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQUEsRUFDaEQsQ0FBQztBQUNIOyIsCiAgIm5hbWVzIjogW10KfQo=
