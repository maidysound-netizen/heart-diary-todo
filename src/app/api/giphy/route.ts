import { handle, requireUser, HttpError } from "@/lib/api";

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
type GiphyItem = { id: string; title?: string; images?: { fixed_width?: GiphyImage } };

// GET /api/giphy?q=검색어  (비우면 인기 스티커)
// GIPHY 키는 서버 환경변수에만 두고, 여기서 대신 검색해 이미지 주소만 돌려준다.
export const GET = handle(async (req: Request) => {
  await requireUser();
  const key = process.env.GIPHY_API_KEY;
  if (!key) throw new HttpError(501, "GIPHY 연결이 아직 안 됐어요.");
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 50);
  const params = new URLSearchParams({ api_key: key, limit: "24", rating: "g" });
  if (q) params.set("q", q);
  const res = await fetch(`https://api.giphy.com/v1/stickers/${q ? "search" : "trending"}?${params}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new HttpError(502, "GIPHY에서 스티커를 불러오지 못했어요.");
  const data = (await res.json()) as { data?: GiphyItem[] };
  const gifs = (data.data ?? []).flatMap((g) => {
    const img = g.images?.fixed_width;
    const url = img?.webp || img?.url;
    const w = Number(img?.width), h = Number(img?.height);
    return url && w && h ? [{ id: g.id, url, w, h, title: g.title ?? "" }] : [];
  });
  return { gifs };
});
