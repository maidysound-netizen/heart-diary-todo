import { put } from "@vercel/blob";
import { handle, requireUser, HttpError } from "@/lib/api";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 4 * 1024 * 1024;

// POST /api/photos/upload (multipart: file) → { url }
// 파일 자체는 Vercel Blob에, DB(page_layout)에는 URL만 저장한다.
export const POST = handle(async (req: Request) => {
  const uid = await requireUser();
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(501, "사진 저장소가 아직 연결되지 않았어요.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "사진 파일이 필요해요.");
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(415, "JPG, PNG, WEBP 사진만 올릴 수 있어요.");
  if (file.size > MAX) throw new HttpError(413, "사진은 4MB 이하만 올릴 수 있어요.");
  const blob = await put(`photos/${uid}/${crypto.randomUUID()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
  });
  return { url: blob.url };
});
