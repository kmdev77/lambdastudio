import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-west-1" });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
  "Content-Type": "application/json",
};

function parseBody(event) {
  let raw = event?.body || "{}";
  if (event?.isBase64Encoded) raw = Buffer.from(raw, "base64").toString("utf8");
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export const handler = async (event) => {
  try {
    const method = event?.requestContext?.http?.method || event?.httpMethod;
    if (method === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS };

    const { filename, contentType = "application/octet-stream" } = parseBody(event);

    const bucket = process.env.BUCKET_NAME;          // <-- from env
    const inPrefix = process.env.INPUT_PREFIX || "uploads/";

    if (!bucket || !filename) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Missing required: filename" }) };
    }

    const base = String(filename).split(/[\\/]/).pop() || "file";
    const key = `${inPrefix}${Date.now()}-${base}`;

    const put = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3, put, { expiresIn: 60 });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ url, key, bucket, contentType }),
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
};
