"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearAuth, getUser, authHeaders } from "@/lib/auth";

type CategoryKey = "top" | "bottom" | "outer" | "headwear" | "shoes" | "accessory";

type ClothingItem = {
  id: string;
  name: string;
  category: CategoryKey;
  brand: string;
  size: string;
  photo: string | null;
  removedBg: string | null;
};

type SelectedState = {
  top: ClothingItem | null;
  outer: ClothingItem | null;
  bottom: ClothingItem | null;
  headwear: ClothingItem | null;
  shoes: ClothingItem | null;
  accessories: ClothingItem[];
};

type TryOnHistoryItem = {
  id: string;
  image: string;
  outfit: ClothingItem[];
  timestamp: Date;
};

type SavedOutfit = {
  id: string;
  name: string;
  ai_suggested: boolean;
  created_at: string;
  items: { item_id: string; name: string; category: string; image_url: string | null }[];
};

async function removeBackground(
  imageDataUrl: string,
  onStep?: (step: "detect" | "segment" | "done") => void,
) {
  onStep?.("detect");

  try {
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append("file", blob, "clothing.jpg");

    onStep?.("segment");

    const removeRes = await fetch("/remove-background", { method: "POST", body: formData });
    if (!removeRes.ok) {
      throw new Error(`Remove BG failed: ${removeRes.statusText}`);
    }

    const result = await removeRes.json();
    onStep?.("done");

    return {
      removedDataUrl: result.removed_bg as string,
      meta: {
        category: "top" as CategoryKey,
        garmentName: "Clothing Item",
      },
    };
  } catch (err) {
    console.error("Background removal error:", err);
    // Fallback: return original image
    return {
      removedDataUrl: imageDataUrl,
      meta: { category: "top" as CategoryKey, garmentName: "Clothing Item" },
    };
  }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
}

async function buildOutfitCollage(
  items: Array<{ src: string; label: string }>,
): Promise<string> {
  const W = 520;
  const ITEM_H = 280;
  const LABEL_H = 24;
  const GAP = 12;
  const PAD = 16;
  const H = PAD + items.length * (LABEL_H + ITEM_H + GAP) + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#F4ECE0";
  ctx.fillRect(0, 0, W, H);

  let y = PAD;
  for (const item of items) {
    ctx.fillStyle = "#7A6B5C";
    ctx.font = "bold 14px Inter, sans-serif";
    ctx.fillText(item.label.toUpperCase(), PAD, y + 16);
    y += LABEL_H;

    try {
      const img = await loadImg(item.src);
      drawContain(ctx, img, PAD, y, W - PAD * 2, ITEM_H);
    } catch {
      ctx.fillStyle = "#E8DFD2";
      ctx.fillRect(PAD, y, W - PAD * 2, ITEM_H);
    }

    y += ITEM_H + GAP;
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

async function resolveImage(src: string | null): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  // HTTP URLs → route through backend proxy to avoid canvas CORS taint
  const fetchSrc = src.startsWith("http")
    ? `/proxy-image?url=${encodeURIComponent(src)}`
    : src;
  try {
    const res = await fetch(fetchSrc);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function TryOnStudio() {

  const CATEGORIES = useMemo(
    () => [
      { key: "headwear" as const,  label: "Headwear",    dotClass: "dot-headwear",  tagClass: "tag-headwear",  selectedClass: "selected-headwear"  },
      { key: "top" as const,       label: "Tops",        dotClass: "dot-top",       tagClass: "tag-top",       selectedClass: "selected-top"       },
      { key: "outer" as const,     label: "Outerwear",   dotClass: "dot-outer",     tagClass: "tag-outer",     selectedClass: "selected-outer"     },
      { key: "bottom" as const,    label: "Bottoms",     dotClass: "dot-bottom",    tagClass: "tag-bottom",    selectedClass: "selected-bottom"    },
      { key: "shoes" as const,     label: "Shoes",       dotClass: "dot-shoes",     tagClass: "tag-shoes",     selectedClass: "selected-shoes"     },
      { key: "accessory" as const, label: "Accessories", dotClass: "dot-accessory", tagClass: "tag-accessory", selectedClass: "selected-accessory" },
    ],
    [],
  );

  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [selected, setSelected] = useState<SelectedState>({
    top: null,
    outer: null,
    bottom: null,
    headwear: null,
    shoes: null,
    accessories: [],
  });
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadModalCategory, setUploadModalCategory] = useState<ClothingItem["category"] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tryOnState, setTryOnState] = useState<null | "loading" | "done">(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [removedBgImage, setRemovedBgImage] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: "",
    category: "top" as ClothingItem["category"],
    brand: "",
    size: "M",
  });
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [tryOnResultImage, setTryOnResultImage] = useState<string | null>(null);
  const [userName, setUserName] = useState("User");
  const [topAbove, setTopAbove] = useState(true);
  const [tryOnHistory, setTryOnHistory] = useState<TryOnHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"studio" | "history" | "outfits" | "settings">("studio");
  const [chatOpen, setChatOpen] = useState(false);
  const [editItem, setEditItem] = useState<ClothingItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "top" as CategoryKey, brand: "", size: "" });
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [saveOutfitModal, setSaveOutfitModal] = useState(false);
  const [saveOutfitName, setSaveOutfitName] = useState("");
  const [saveOutfitAi, setSaveOutfitAi] = useState(false);
  const [saveOutfitItemIds, setSaveOutfitItemIds] = useState<string[] | null>(null);
  const [settingsName, setSettingsName] = useState("");
  const [weather, setWeather] = useState<{ temperature: number; description: string; unit: string } | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string; recommendedItems?: ClothingItem[] }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (chatOpen) {
      fetch("/api/chat/sessions", { headers: authHeaders() })
        .then((r) => r.ok ? r.json() : [])
        .then(setChatSessions)
        .catch(() => {});
    }
  }, [chatOpen]);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg = { role: "user" as const, content: text };
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          message: text,
          history: chatMessages.map(({ role, content }) => ({ role, content })),
          lat: userCoords?.lat ?? null,
          lon: userCoords?.lon ?? null,
          session_id: currentSessionId,
        }),
      });
      const data = await res.json();
      if (data.session_id) {
        setCurrentSessionId(data.session_id);
        setChatSessions((prev) => {
          const exists = prev.find((s) => s.id === data.session_id);
          if (exists) return prev;
          return [{ id: data.session_id, title: text.slice(0, 60), created_at: new Date().toISOString() }, ...prev];
        });
      }
      const names: string[] = data.recommended_items ?? [];
      const matched = names
        .map((name: string) => wardrobe.find((w) => w.name.toLowerCase() === name.toLowerCase()))
        .filter(Boolean) as ClothingItem[];
      setChatMessages([...updatedHistory, { role: "assistant", content: data.reply, recommendedItems: matched }]);
    } catch {
      setChatMessages([...updatedHistory, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const loadChatSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, { headers: authHeaders() });
      if (!res.ok) return;
      const msgs = await res.json();
      setChatMessages(msgs.map((m: any) => ({
        role: m.role,
        content: m.content,
        recommendedItems: m.recommended_items?.map((ri: any) => ({
          id: ri.id, name: ri.name, category: ri.category as CategoryKey,
          brand: ri.brand || "", size: ri.size || "",
          photo: ri.photo, removedBg: ri.removedBg,
        })) ?? [],
      })));
      setCurrentSessionId(sessionId);
      setShowSessions(false);
    } catch { /* silent */ }
  };

  const deleteChatSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE", headers: authHeaders() });
    setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setChatMessages([]);
      setCurrentSessionId(null);
    }
  };

  const startNewChat = () => {
    setChatMessages([]);
    setCurrentSessionId(null);
    setShowSessions(false);
  };

  const openSaveOutfitModal = (aiSuggested = false, itemIds: string[] | null = null) => {
    setSaveOutfitName("");
    setSaveOutfitAi(aiSuggested);
    setSaveOutfitItemIds(itemIds);
    setSaveOutfitModal(true);
  };

  const saveOutfit = async () => {
    const ids = saveOutfitItemIds ?? selectedOutfit.map((i) => i.id);
    if (!ids.length || !saveOutfitName.trim()) return;
    try {
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: saveOutfitName.trim(), item_ids: ids, ai_suggested: saveOutfitAi }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setSavedOutfits((prev) => [created, ...prev]);
      setSaveOutfitModal(false);
      setSaveOutfitName("");
      showToast("✓ Outfit saved!");
    } catch {
      showToast("❌ Failed to save outfit");
    }
  };

  const deleteOutfit = async (outfitId: string) => {
    try {
      await fetch(`/api/outfits/${outfitId}`, { method: "DELETE", headers: authHeaders() });
      setSavedOutfits((prev) => prev.filter((o) => o.id !== outfitId));
      showToast("✓ Outfit deleted");
    } catch {
      showToast("❌ Failed to delete outfit");
    }
  };

  const loadOutfit = (outfit: SavedOutfit) => {
    const newSelected: SelectedState = { top: null, outer: null, bottom: null, headwear: null, shoes: null, accessories: [] };
    outfit.items.forEach((oi) => {
      const found = wardrobe.find((w) => w.id === oi.item_id);
      if (!found) return;
      if (found.category === "accessory") {
        newSelected.accessories.push(found);
      } else {
        (newSelected as any)[found.category] = found;
      }
    });
    setSelected(newSelected);
    setActiveTab("studio");
    showToast(`✓ Outfit "${outfit.name}" loaded`);
  };

  const openEditModal = (item: ClothingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditItem(item);
    setEditForm({ name: item.name, category: item.category, brand: item.brand, size: item.size });
  };

  const saveEditItem = async () => {
    if (!editItem) return;
    try {
      const res = await fetch(`/api/wardrobe/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setWardrobe((prev) => prev.map((w) => w.id === editItem.id ? { ...w, name: updated.name, category: updated.category as CategoryKey, brand: updated.brand || "", size: updated.size || "" } : w));
      setSelected((prev) => {
        const newSel = { ...prev };
        (Object.keys(newSel) as (keyof SelectedState)[]).forEach((key) => {
          if (key === "accessories") {
            newSel.accessories = newSel.accessories.map((a) => a.id === editItem.id ? { ...a, name: updated.name, category: updated.category as CategoryKey, brand: updated.brand || "", size: updated.size || "" } : a);
          } else if ((newSel[key] as ClothingItem | null)?.id === editItem.id) {
            (newSel as any)[key] = { ...(newSel[key] as ClothingItem), name: updated.name, category: updated.category as CategoryKey, brand: updated.brand || "", size: updated.size || "" };
          }
        });
        return newSel;
      });
      showToast("✓ Item updated");
      setEditItem(null);
    } catch {
      showToast("❌ Failed to update item");
    }
  };

  const downloadImage = (dataUrl: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `tryon_${Date.now()}.jpg`;
    a.click();
  };

  useEffect(() => {
    const user = getUser();
    if (user?.name) setUserName(user.name);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setUserCoords({ lat: coords.latitude, lon: coords.longitude });
        try {
          const r = await fetch(`/weather?lat=${coords.latitude}&lon=${coords.longitude}`);
          if (r.ok) setWeather(await r.json());
        } catch { /* silent */ }
      },
      () => { /* user denied — no weather shown */ },
    );
  }, []);

  useEffect(() => {
    fetch("/api/outfits", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then(setSavedOutfits)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/wardrobe", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((items: Array<{ id: string; name: string; category: string; brand: string; size: string; image_url: string | null }>) => {
        setWardrobe(items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category as CategoryKey,
          brand: i.brand || "",
          size: i.size || "",
          photo: i.image_url,
          removedBg: i.image_url?.startsWith("http") ? i.image_url : null,
        })));
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result;
      if (typeof dataUrl !== "string") return;

      setPreviewImage(dataUrl);
      setProcessingImage(true);
      showToast("🔄 Processing image...");

      try {
        const { removedDataUrl } = await removeBackground(dataUrl, (step) => {
          console.log("Background removal step:", step);
        });

        setRemovedBgImage(removedDataUrl);
        showToast("🔍 Recognizing clothing...");

        // Auto-fill form via Gemini Vision
        try {
          const blob = await (await fetch(removedDataUrl)).blob();
          const fd = new FormData();
          fd.append("file", blob, "clothing.jpg");
          const res = await fetch("/analyze-clothing", { method: "POST", body: fd });
          if (res.ok) {
            const info = await res.json();
            setItemForm((p) => ({
              ...p,
              name: info.name || p.name,
              category: (info.category as ClothingItem["category"]) || p.category,
            }));
          }
        } catch {
          // Recognition failed silently — user fills manually
        }

        showToast("✓ Done! Check details and add.");
        setProcessingImage(false);
      } catch (err) {
        console.error("Error processing image:", err);
        showToast("Error processing image");
        setProcessingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const openUploadModal = (category: ClothingItem["category"]) => {
    setUploadModalCategory(category);
    setItemForm((p) => ({ ...p, category }));
    setUploadModal(true);
  };

  const closeUploadModal = () => {
    setUploadModal(false);
    setUploadModalCategory(null);
    setPreviewImage(null);
    setRemovedBgImage(null);
    setProcessingImage(false);
    setItemForm({ name: "", category: "top", brand: "", size: "M" });
  };

  const handleAddItem = async () => {
    if (!previewImage) {
      showToast("Select image first");
      return;
    }
    if (!itemForm.name.trim()) {
      showToast("Enter item name");
      return;
    }

    setProcessingImage(true);
    showToast("🔄 Saving to wardrobe...");

    try {
      const createRes = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: itemForm.name,
          category: itemForm.category,
          brand: itemForm.brand || null,
          size: itemForm.size || null,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create item");
      const created = await createRes.json();

      let finalPhotoUrl: string | null = previewImage;

      const imageToUpload = removedBgImage || previewImage;
      const blob = await (await fetch(imageToUpload)).blob();
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const formData = new FormData();
      formData.append("file", blob, `clothing.${ext}`);
      const imgRes = await fetch(`/api/wardrobe/${created.id}/image`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (imgRes.ok) {
        const updated = await imgRes.json();
        finalPhotoUrl = updated.image_url;
      }

      const newItem: ClothingItem = {
        id: created.id,
        name: created.name,
        category: created.category as CategoryKey,
        brand: created.brand || "",
        size: created.size || "",
        photo: finalPhotoUrl,
        removedBg: finalPhotoUrl,
      };

      setWardrobe((prev) => [...prev, newItem]);
      showToast("✓ Item saved!");
      closeUploadModal();
    } catch (err) {
      console.error("Error saving item:", err);
      showToast("❌ Error saving item");
      setProcessingImage(false);
    }
  };

  const toggleItem = (item: ClothingItem) => {
    if (item.category === "accessory") {
      setSelected((prev) => {
        const exists = prev.accessories.some((a) => a.id === item.id);
        return {
          ...prev,
          accessories: exists
            ? prev.accessories.filter((a) => a.id !== item.id)
            : [...prev.accessories, item],
        };
      });
    } else {
      setSelected((prev) => ({
        ...prev,
        [item.category]: (prev[item.category as keyof Omit<SelectedState, "accessories">] as ClothingItem | null)?.id === item.id ? null : item,
      }));
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!itemId.startsWith("local_")) {
      try {
        await fetch(`/api/wardrobe/${itemId}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
    setWardrobe((prev) => prev.filter((item) => item.id !== itemId));
    setSelected((prev) => ({
      ...prev,
      top: prev.top?.id === itemId ? null : prev.top,
      outer: prev.outer?.id === itemId ? null : prev.outer,
      bottom: prev.bottom?.id === itemId ? null : prev.bottom,
      headwear: prev.headwear?.id === itemId ? null : prev.headwear,
      shoes: prev.shoes?.id === itemId ? null : prev.shoes,
      accessories: prev.accessories.filter((a) => a.id !== itemId),
    }));
    showToast("✓ Item deleted");
  };

  const selectedOutfit = [
    selected.top, selected.outer, selected.bottom,
    selected.headwear, selected.shoes,
    ...selected.accessories,
  ].filter(Boolean) as ClothingItem[];

  const generateTryOn = async () => {
    if (!avatarImage) {
      showToast("Upload your body photo first");
      return;
    }
    if (!selected.top && !selected.bottom && !selected.outer && !selected.headwear && !selected.shoes && selected.accessories.length === 0) {
      showToast("Select items first");
      return;
    }

    if (selected.top && !selected.top.removedBg && !selected.top.photo) {
      showToast("Upload photo for TOP item");
      return;
    }
    if (selected.bottom && !selected.bottom.removedBg && !selected.bottom.photo) {
      showToast("Upload photo for BOTTOM item");
      return;
    }
    if (selected.outer && !selected.outer.removedBg && !selected.outer.photo) {
      showToast("Upload photo for OUTER item");
      return;
    }

    setTryOnState("loading");
    setTryOnResultImage(null);
    showToast("🔄 Building outfit collage...");

    try {
      // Resolve all clothing images to base64 in parallel
      const [resolvedTop, resolvedBottom, resolvedOuter, resolvedHeadwear, resolvedShoes] = await Promise.all([
        resolveImage(selected.top ? (selected.top.removedBg || selected.top.photo) : null),
        resolveImage(selected.bottom ? (selected.bottom.removedBg || selected.bottom.photo) : null),
        resolveImage(selected.outer ? (selected.outer.removedBg || selected.outer.photo) : null),
        resolveImage(selected.headwear ? (selected.headwear.removedBg || selected.headwear.photo) : null),
        resolveImage(selected.shoes ? (selected.shoes.removedBg || selected.shoes.photo) : null),
      ]);

      // Build ordered outfit collage (top → outer → bottom → headwear → shoes → accessories)
      const collageItems: Array<{ src: string; label: string }> = [];
      if (resolvedTop && selected.top) collageItems.push({ src: resolvedTop, label: selected.top.name });
      if (resolvedOuter && selected.outer) collageItems.push({ src: resolvedOuter, label: selected.outer.name });
      if (resolvedBottom && selected.bottom) collageItems.push({ src: resolvedBottom, label: selected.bottom.name });
      if (resolvedHeadwear && selected.headwear) collageItems.push({ src: resolvedHeadwear, label: selected.headwear.name });
      if (resolvedShoes && selected.shoes) collageItems.push({ src: resolvedShoes, label: selected.shoes.name });

      if (selected.accessories.length > 0) {
        const resolvedAccs = await Promise.all(
          selected.accessories.map((a) => resolveImage(a.removedBg || a.photo))
        );
        selected.accessories.forEach((a, i) => {
          if (resolvedAccs[i]) collageItems.push({ src: resolvedAccs[i]!, label: a.name });
        });
      }

      showToast("🔄 Generating outfit...");
      const outfitCollage = await buildOutfitCollage(collageItems);

      const payload: any = {
        avatar_image_base64: avatarImage,
        outfit_collage_base64: outfitCollage,
        top_name: selected.top?.name,
        bottom_name: selected.bottom?.name,
        outer_name: selected.outer?.name,
        headwear_name: selected.headwear?.name,
        shoes_name: selected.shoes?.name,
        accessories: selected.accessories.map((a) => ({ name: a.name })),
      };

      const response = await fetch("/generate-tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP error: ${response.status}. ${text}`);
      }

      const result = await response.json();

      if (result.preview_url) {
        setTryOnState("done");
        showToast("✓ Try-on generated!");
        const resultImage = result.preview_image_data_url || result.preview_url;
        setTryOnResultImage(resultImage);
        setTryOnHistory((prev) => [
          { id: `tryon_${Date.now()}`, image: resultImage, outfit: [...selectedOutfit], timestamp: new Date() },
          ...prev,
        ]);
      } else {
        throw new Error(result.error || "Failed to generate try-on");
      }
    } catch (err) {
      console.error("Error generating try-on:", err);
      showToast("❌ Error generating try-on");
      setTryOnState(null);
      setTryOnResultImage(null);
    }
  };

  return (
    <div className={`app${showRightPanel ? "" : " panel-collapsed"}`}>
      {/* HEADER */}
      <div className="header">
        <div className="header-logo">
          WARDROBE<span>.AI</span>
        </div>
        <div className="header-nav">
          <a href="#" className={activeTab === "studio" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("studio"); }}>
            Studio
          </a>
          <a href="#" className={activeTab === "history" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("history"); }}>
            History {tryOnHistory.length > 0 && `(${tryOnHistory.length})`}
          </a>
          <a href="#" className={activeTab === "outfits" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("outfits"); }}>
            Outfits {savedOutfits.length > 0 && `(${savedOutfits.length})`}
          </a>
          <a href="#" className={activeTab === "settings" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("settings"); }}>
            Settings
          </a>
        </div>
        <div className="header-user">
          {weather && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-secondary)", marginRight: "8px", padding: "4px 10px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <span>{weather.temperature}{weather.unit}</span>
              <span style={{ opacity: 0.7 }}>·</span>
              <span>{weather.description}</span>
            </div>
          )}
          <span>{userName}</span>
          <div className="avatar">{userName[0]?.toUpperCase()}</div>
          <button
            onClick={handleLogout}
            style={{ marginLeft: "12px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: "8px", color: "var(--text-secondary)", fontSize: "11px", padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-color)"; e.currentTarget.style.color = "var(--accent-color)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* SIDEBAR LEFT */}
      <div className="sidebar-left">
        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <div className="category-section">
              <div className="category-header">
                <div className="category-label">
                  <div className={`category-dot ${cat.dotClass}`}></div>
                  {cat.label}
                </div>
                <div className="category-count">{wardrobe.filter((w) => w.category === cat.key).length}</div>
              </div>
              <div className="h-scroll-track">
                {wardrobe
                  .filter((w) => w.category === cat.key)
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`card-item ${
                        cat.key === "accessory"
                          ? selected.accessories.some((a) => a.id === item.id) ? cat.selectedClass : ""
                          : (selected as any)[cat.key]?.id === item.id ? cat.selectedClass : ""
                      }`}
                      onClick={() => toggleItem(item)}
                      title={item.name}
                    >
                      <div className="card-check">✓</div>
                      <div
                        className="card-delete"
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                      >
                        ✕
                      </div>
                      <div
                        onClick={(e) => openEditModal(item, e)}
                        style={{ position: "absolute", top: "6px", left: "6px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2, opacity: 0, transition: "opacity 0.2s" }}
                        className="card-edit-btn"
                      >
                        ✎
                      </div>
                      <div className="card-thumb">
                        {item.removedBg ? (
                          <img src={item.removedBg} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : item.photo ? (
                          <img src={item.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ fontSize: "28px", opacity: 0.4 }}>▣</div>
                        )}
                      </div>
                      <div className="card-body">
                        <div className="card-name">{item.name}</div>
                        <div className="card-meta">{item.brand || "Custom"}</div>
                      </div>
                    </div>
                  ))}
                <div className="card-add" onClick={() => openUploadModal(cat.key)}>
                  <div className="card-add-icon">+</div>
                  <div>Add</div>
                </div>
              </div>
            </div>
            {CATEGORIES.indexOf(cat) < CATEGORIES.length - 1 && <div className="cat-divider"></div>}
          </div>
        ))}

        {selectedOutfit.length > 0 && (
          <div className="outfit-summary">
            <div className="outfit-summary-title">Selected Outfit</div>
            <div className="outfit-summary-items">
              {selectedOutfit.map((item) => {
                const styleClass = item.category === "top" ? "tag-top"
                  : item.category === "bottom" ? "tag-bottom"
                  : item.category === "outer" ? "tag-outer"
                  : item.category === "headwear" ? "tag-headwear"
                  : item.category === "shoes" ? "tag-shoes"
                  : "tag-accessory";
                return (
                  <div
                    key={item.id}
                    className={`outfit-tag ${styleClass}`}
                  >
                    {item.name?.substring(0, 10)}
                    <span
                      className="tag-remove"
                      onClick={() => {
                        if (item.category === "accessory") {
                          setSelected((p) => ({ ...p, accessories: p.accessories.filter((a) => a.id !== item.id) }));
                        } else {
                          setSelected((p) => ({ ...p, [item.category]: null } as any));
                        }
                      }}
                    >
                      ×
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CANVAS */}
      <div className="main">
        <div className="main-toolbar">
          <div className="toolbar-title">
            Outfit Studio
            <span style={{ marginLeft: "12px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", fontWeight: 400 }}>
              {wardrobe.length} items in wardrobe
            </span>
          </div>
          <div className="toolbar-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setSelected({ top: null, outer: null, bottom: null, headwear: null, shoes: null, accessories: [] })}
            >
              Clear
            </button>
            <button
              className="btn btn-ghost"
              disabled={selectedOutfit.length === 0}
              onClick={() => openSaveOutfitModal(false, null)}
            >
              Save outfit
            </button>
            <button className="btn btn-primary" disabled={selectedOutfit.length === 0} onClick={generateTryOn}>
              {tryOnState === "loading" ? "🔄 Generating..." : "Generate outfit ✨"}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowRightPanel(!showRightPanel)} title="Toggle panel">
              {showRightPanel ? "▶" : "◀"}
            </button>
          </div>
        </div>

        <div className="canvas-area">
          {activeTab === "settings" && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "32px" }}>
            <div style={{ maxWidth: "520px" }}>
              <div style={{ marginBottom: "32px" }}>
                <div className="panel-title" style={{ marginBottom: "16px" }}>Profile</div>
                <div className="analysis-card">
                  <div style={{ marginBottom: "12px" }}>
                    <div className="form-label">Display Name</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        className="form-input"
                        value={settingsName}
                        placeholder={userName}
                        onChange={(e) => setSettingsName(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={!settingsName.trim()}
                        onClick={() => { setUserName(settingsName.trim()); setSettingsName(""); showToast("✓ Name updated"); }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "32px" }}>
                <div className="panel-title" style={{ marginBottom: "16px" }}>Data</div>
                <div className="analysis-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cream-dim)" }}>
                      Try-on history ({tryOnHistory.length} items)
                    </span>
                    <button
                      className="btn btn-ghost"
                      disabled={tryOnHistory.length === 0}
                      onClick={() => { setTryOnHistory([]); showToast("✓ History cleared"); }}
                      style={{ fontSize: "11px" }}
                    >
                      Clear History
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--cream-dim)" }}>
                      Wardrobe ({wardrobe.length} items)
                    </span>
                    <button
                      className="btn btn-ghost"
                      disabled={wardrobe.length === 0}
                      onClick={() => { setWardrobe([]); setSelected({ top: null, outer: null, bottom: null, headwear: null, shoes: null, accessories: [] }); showToast("✓ Wardrobe cleared"); }}
                      style={{ fontSize: "11px" }}
                    >
                      Clear Wardrobe
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {activeTab === "outfits" && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "24px" }}>
              {savedOutfits.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👗</div>
                  <div className="empty-title">No Saved Outfits</div>
                  <div className="empty-sub">Select items on the canvas and click "Save outfit"</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
                  {savedOutfits.map((outfit) => (
                    <div key={outfit.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)" }}>
                      {/* Item previews */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "12px", background: "var(--bg-secondary)", minHeight: "80px" }}>
                        {outfit.items.slice(0, 4).map((oi) => (
                          <div key={oi.item_id} style={{ width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {oi.image_url ? (
                              <img src={oi.image_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            ) : (
                              <div style={{ fontSize: "20px", opacity: 0.3 }}>▣</div>
                            )}
                          </div>
                        ))}
                        {outfit.items.length > 4 && (
                          <div style={{ width: "52px", height: "52px", borderRadius: "8px", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-secondary)" }}>
                            +{outfit.items.length - 4}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{outfit.name}</div>
                          {outfit.ai_suggested && (
                            <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: "20px", background: "linear-gradient(135deg, #7c6fa0, #d4af37)", color: "#fff" }}>
                              AI
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                          {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""} · {outfit.created_at}
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="btn btn-primary" style={{ flex: 1, fontSize: "12px" }} onClick={() => loadOutfit(outfit)}>
                            Wear it
                          </button>
                          <button className="btn btn-ghost" style={{ fontSize: "12px" }} onClick={() => deleteOutfit(outfit.id)}>
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "24px" }}>
              {tryOnHistory.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🕐</div>
                  <div className="empty-title">No History Yet</div>
                  <div className="empty-sub">Generated try-ons will appear here</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                  {tryOnHistory.map((item) => (
                    <div key={item.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", background: "var(--surface)" }}>
                      <img src={item.image} style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "3/4" }} />
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: "13px", marginBottom: "4px", color: "var(--text-muted)" }}>{item.outfit.map((o) => o.name).join(", ")}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", marginBottom: "8px" }}>
                          {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <button className="btn btn-ghost" onClick={() => downloadImage(item.image)} style={{ width: "100%", fontSize: "12px" }}>
                          ⬇ Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === "studio" && (selectedOutfit.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👗</div>
              <div className="empty-title">Select Items to Try</div>
              <div className="empty-sub">Choose clothing from the left to see your virtual try-on</div>
            </div>
          ) : (
            <div className="flatlay-stage">
              <div className={`flatlay-canvas${tryOnState === "loading" ? " scanning" : ""}`}>
                {tryOnState === "loading" && <div className="scan-line"></div>}

                <div className="flatlay-left">
                  {selected.headwear && (
                    <div className="flatlay-item flatlay-headwear">
                      {selected.headwear.removedBg || selected.headwear.photo ? (
                        <img src={selected.headwear.removedBg || selected.headwear.photo!} alt={selected.headwear.name} />
                      ) : (
                        <div className="flatlay-emoji">🎩</div>
                      )}
                      <div className="flatlay-label">Headwear: {selected.headwear.name}</div>
                    </div>
                  )}

                  {selected.top && (
                    <div
                      className="flatlay-item flatlay-top"
                      style={{ zIndex: topAbove ? 2 : 1, cursor: "pointer" }}
                      onClick={() => setTopAbove((p) => !p)}
                      title="Click to swap layer"
                    >
                      {selected.top.removedBg || selected.top.photo ? (
                        <img src={selected.top.removedBg || selected.top.photo!} alt={selected.top.name} />
                      ) : (
                        <div className="flatlay-emoji">👕</div>
                      )}
                      <div className="flatlay-label">Top: {selected.top.name}</div>
                    </div>
                  )}

                  {selected.outer && (
                    <div
                      className="flatlay-item flatlay-outer"
                      style={{
                        zIndex: topAbove ? 1 : 2,
                        cursor: selected.top ? "pointer" : "default",
                        marginTop: selected.top ? "-192px" : undefined,
                        marginLeft: selected.top ? "20px" : undefined,
                      }}
                      onClick={() => selected.top && setTopAbove((p) => !p)}
                      title={selected.top ? "Click to swap layer" : undefined}
                    >
                      {selected.outer.removedBg || selected.outer.photo ? (
                        <img src={selected.outer.removedBg || selected.outer.photo!} alt={selected.outer.name} />
                      ) : (
                        <div className="flatlay-emoji">🥼</div>
                      )}
                      <div className="flatlay-label">Outerwear: {selected.outer.name}</div>
                    </div>
                  )}

                  {selected.bottom && (
                    <div className="flatlay-item flatlay-bottom">
                      {selected.bottom.removedBg || selected.bottom.photo ? (
                        <img src={selected.bottom.removedBg || selected.bottom.photo!} alt={selected.bottom.name} />
                      ) : (
                        <div className="flatlay-emoji">👖</div>
                      )}
                      <div className="flatlay-label">Bottoms: {selected.bottom.name}</div>
                    </div>
                  )}

                  {selected.shoes && (
                    <div className="flatlay-item flatlay-shoes">
                      {selected.shoes.removedBg || selected.shoes.photo ? (
                        <img src={selected.shoes.removedBg || selected.shoes.photo!} alt={selected.shoes.name} />
                      ) : (
                        <div className="flatlay-emoji">👟</div>
                      )}
                      <div className="flatlay-label">Shoes: {selected.shoes.name}</div>
                    </div>
                  )}
                </div>

                <div className="flatlay-right">
                  <div className="flatlay-accessories-title">Accessories</div>
                  {selected.accessories.length === 0 ? (
                    <div className="flatlay-no-accessory">No accessories selected</div>
                  ) : (
                    <div className="flatlay-accessories-list">
                      {selected.accessories.map((acc) => (
                        <div key={acc.id} className="flatlay-accessory-item">
                          {acc.removedBg || acc.photo ? (
                            <img src={acc.removedBg || acc.photo!} alt={acc.name} />
                          ) : (
                            <div className="flatlay-emoji">💍</div>
                          )}
                          <div className="flatlay-label">{acc.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="outfit-chips">
                {selectedOutfit.map((item) => (
                  <div key={item.id} className="outfit-chip">
                    <div className="chip-dot"></div>
                    {item.name?.substring(0, 12)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SIDEBAR RIGHT */}
      <div className={`sidebar-right${showRightPanel ? "" : " collapsed"}`}>
          <div>
            <div className="panel-title">Your photo</div>
            {avatarImage ? (
              <div style={{ marginBottom: "16px" }}>
                <img src={avatarImage} style={{ width: "100%", borderRadius: "8px", marginBottom: "8px" }} />
                <button className="btn btn-ghost" onClick={() => setAvatarImage(null)} style={{ width: "100%" }}>
                  Remove Photo
                </button>
              </div>
            ) : (
              <button
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                style={{ marginBottom: "16px" }}
              >
                📸 Upload Body Photo
              </button>
            )}
            <input
              ref={fileInputRef}
              id="avatar-input"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const result = ev.target?.result;
                    if (typeof result === "string") setAvatarImage(result);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>

          {selectedOutfit.length > 0 && (
            <div>
              <div className="panel-title">Your outfit</div>
              <div className="analysis-card">
                <div className="analysis-row">
                  <span className="analysis-key">Top</span>
                  <span className="analysis-val">{selected.top?.name?.substring(0, 12) || "—"}</span>
                </div>
                <div className="analysis-row">
                  <span className="analysis-key">Bottom</span>
                  <span className="analysis-val">{selected.bottom?.name?.substring(0, 12) || "—"}</span>
                </div>
                {selected.outer && (
                  <div className="analysis-row">
                    <span className="analysis-key">Outer</span>
                    <span className="analysis-val">{selected.outer?.name?.substring(0, 12) || "—"}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {tryOnState === "done" && (
            <div>
              <div className="panel-title">Try-On Result</div>
              <div className="tryon-result">
                <div className="tryon-header">
                  <div className="tryon-title">AI Generated</div>
                  <div className="status-dot dot-done"></div>
                </div>
                <div className="tryon-body">
                  <div className="tryon-preview">
                    {tryOnResultImage ? (
                      <img
                        src={tryOnResultImage}
                        alt="Try-on result"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ fontSize: "14px", textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                        Select items and click Generate
                      </div>
                    )}
                  </div>

                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setTryOnState(null); setTryOnResultImage(null); }}
                  style={{ flex: 1 }}
                >
                  Clear
                </button>
                {tryOnResultImage && (
                  <button
                    className="btn btn-primary"
                    onClick={() => downloadImage(tryOnResultImage)}
                    style={{ flex: 1 }}
                  >
                    ⬇ Download
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

      {/* UPLOAD MODAL */}
      {uploadModal && (
        <div
          className="modal-bg"
          onClick={() => {
            if (!processingImage) closeUploadModal();
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              Add to{" "}
              <span style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: "20px",
                background:
                  uploadModalCategory === "headwear" ? "rgba(124,111,160,0.15)"
                    : uploadModalCategory === "top" ? "rgba(212,175,55,0.15)"
                    : uploadModalCategory === "outer" ? "rgba(100,149,237,0.15)"
                    : uploadModalCategory === "bottom" ? "rgba(184,115,51,0.15)"
                    : uploadModalCategory === "shoes" ? "rgba(106,143,122,0.15)"
                    : "rgba(201,168,76,0.15)",
                color:
                  uploadModalCategory === "headwear" ? "#7c6fa0"
                    : uploadModalCategory === "top" ? "#d4af37"
                    : uploadModalCategory === "outer" ? "#6495ed"
                    : uploadModalCategory === "bottom" ? "#b87333"
                    : uploadModalCategory === "shoes" ? "#6a8f7a"
                    : "#b87333",
                border: `1px solid ${
                  uploadModalCategory === "headwear" ? "#7c6fa040"
                    : uploadModalCategory === "top" ? "#d4af3740"
                    : uploadModalCategory === "outer" ? "#6495ed40"
                    : uploadModalCategory === "bottom" ? "#b8733340"
                    : uploadModalCategory === "shoes" ? "#6a8f7a40"
                    : "#b8733340"
                }`,
              }}>
                {uploadModalCategory === "headwear" ? "Headwear"
                  : uploadModalCategory === "top" ? "Tops"
                  : uploadModalCategory === "outer" ? "Outerwear"
                  : uploadModalCategory === "bottom" ? "Bottoms"
                  : uploadModalCategory === "shoes" ? "Shoes"
                  : "Accessories"}
              </span>
            </div>
            <div className="modal-sub">Upload a photo and fill in details</div>

            <div className="photo-drop">
              <input type="file" accept="image/*" onChange={handleFileUpload} />
              {previewImage ? (
                <div className="photo-preview-wrap">
                  <img src={previewImage} className="photo-preview-img" />
                  {processingImage && (
                    <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <div className="spinner"></div>
                      <div style={{ fontSize: "11px", color: "var(--gold)" }}>Processing...</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="photo-drop-placeholder">
                  <div className="pd-icon">📸</div>
                  <div className="pd-text">
                    Drop photo here or <strong>click</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="form-field">
              <label className="form-label">Item Name</label>
              <input
                className="form-input"
                placeholder="e.g., Blue Silk Blouse"
                value={itemForm.name}
                onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Brand</label>
              <input
                className="form-input"
                placeholder="e.g., Zara"
                value={itemForm.brand}
                onChange={(e) => setItemForm((p) => ({ ...p, brand: e.target.value }))}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Size</label>
              <input
                className="form-input"
                placeholder="e.g., M"
                value={itemForm.size}
                onChange={(e) => setItemForm((p) => ({ ...p, size: e.target.value }))}
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={closeUploadModal}
                disabled={processingImage}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddItem} disabled={!previewImage || !itemForm.name || processingImage}>
                {processingImage ? "🔄 Processing..." : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE OUTFIT MODAL */}
      {saveOutfitModal && (
        <div className="modal-bg" onClick={() => setSaveOutfitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "360px" }}>
            <div className="modal-title">Save Outfit</div>
            <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
              {selectedOutfit.length} item{selectedOutfit.length !== 1 ? "s" : ""}: {selectedOutfit.map((i) => i.name).join(", ")}
            </div>
            <div>
              <div className="form-label">Outfit name</div>
              <input
                className="form-input"
                value={saveOutfitName}
                onChange={(e) => setSaveOutfitName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveOutfit(); }}
                placeholder="e.g. Date night, Office look..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button className="btn btn-ghost" onClick={() => setSaveOutfitModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!saveOutfitName.trim()} onClick={saveOutfit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editItem && (
        <div className="modal-bg" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div className="modal-title">Edit Item</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div className="form-label">Name</div>
                <input className="form-input" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Category</div>
                <select className="form-input" value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value as CategoryKey }))}>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="outer">Outerwear</option>
                  <option value="shoes">Shoes</option>
                  <option value="headwear">Headwear</option>
                  <option value="accessory">Accessory</option>
                </select>
              </div>
              <div>
                <div className="form-label">Brand</div>
                <input className="form-input" value={editForm.brand} onChange={(e) => setEditForm((p) => ({ ...p, brand: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <div className="form-label">Size</div>
                <input className="form-input" value={editForm.size} onChange={(e) => setEditForm((p) => ({ ...p, size: e.target.value }))} placeholder="Optional" />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button className="btn btn-ghost" onClick={() => setEditItem(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={!editForm.name.trim()} onClick={saveEditItem}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="toast">
          <div className="toast-icon">✓</div> {toast}
        </div>
      )}

      {/* FLOATING ASSISTANT */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
        {chatOpen && (
          <div style={{ width: "360px", height: "520px", background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Chat header */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)", gap: "8px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontFamily: "var(--font-serif)", color: "var(--text-primary)", fontWeight: 600 }}>Style Assistant</div>
                {weather && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{weather.temperature}{weather.unit} · {weather.description}</div>}
              </div>
              <button onClick={() => setShowSessions((s) => !s)} style={{ background: showSessions ? "var(--accent-color)" : "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "8px", cursor: "pointer", fontSize: "11px", color: showSessions ? "#fff" : "var(--text-secondary)", padding: "4px 10px", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                Chats {chatSessions.length > 0 && `(${chatSessions.length})`}
              </button>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-secondary)", lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

            {/* Sessions panel */}
            {showSessions && (
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <button onClick={startNewChat} style={{ margin: "12px 16px 4px", padding: "10px", background: "var(--accent-color)", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit", fontWeight: 600 }}>
                  + New chat
                </button>
                {chatSessions.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>No saved chats yet</div>
                ) : (
                  <div style={{ padding: "8px 0" }}>
                    {chatSessions.map((s) => (
                      <div key={s.id} onClick={() => loadChatSession(s.id)}
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", cursor: "pointer", background: s.id === currentSessionId ? "var(--bg-secondary)" : "transparent", borderLeft: s.id === currentSessionId ? "2px solid var(--accent-color)" : "2px solid transparent" }}
                        onMouseEnter={(e) => { if (s.id !== currentSessionId) e.currentTarget.style.background = "var(--bg-secondary)"; }}
                        onMouseLeave={(e) => { if (s.id !== currentSessionId) e.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "2px" }}>{s.created_at}</div>
                        </div>
                        <button onClick={(e) => deleteChatSession(s.id, e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "var(--text-secondary)", padding: "2px 4px", flexShrink: 0, opacity: 0.6 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {!showSessions && <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", marginTop: "24px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>✨</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "16px" }}>
                    Ask me to build an outfit for any occasion. I know your wardrobe{weather ? ` and the weather` : ""}.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {["What should I wear today?", "Build an outfit for a date night", "What to wear tomorrow?", "Smart casual look"].map((hint) => (
                      <button key={hint} onClick={() => setChatInput(hint)}
                        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "8px 14px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "8px" }}>
                  <div style={{
                    maxWidth: "85%", padding: "10px 14px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "var(--accent-color)" : "var(--bg-secondary)",
                    color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                    fontSize: "13px", lineHeight: "1.6", whiteSpace: "pre-wrap",
                    border: msg.role === "assistant" ? "1px solid var(--border-subtle)" : "none",
                  }}>
                    {msg.content}
                  </div>

                  {/* Recommended item cards */}
                  {msg.role === "assistant" && msg.recommendedItems && msg.recommendedItems.length > 0 && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {msg.recommendedItems.map((item) => (
                          <div key={item.id} style={{ width: "100px", border: "1px solid var(--border-subtle)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)", cursor: "pointer" }}
                            onClick={() => toggleItem(item)} title={`Click to select ${item.name}`}>
                            <div style={{ width: "100%", height: "80px", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              {(item.removedBg || item.photo) ? (
                                <img src={item.removedBg || item.photo!} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              ) : (
                                <div style={{ fontSize: "24px", opacity: 0.3 }}>▣</div>
                              )}
                            </div>
                            <div style={{ padding: "6px 8px" }}>
                              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                              <div style={{ fontSize: "9px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.category}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            const newSelected: SelectedState = { top: null, outer: null, bottom: null, headwear: null, shoes: null, accessories: [] };
                            msg.recommendedItems!.forEach((item) => {
                              if (item.category === "accessory") {
                                newSelected.accessories.push(item);
                              } else {
                                (newSelected as any)[item.category] = item;
                              }
                            });
                            setSelected(newSelected);
                            showToast("✓ Outfit applied to canvas");
                            setChatOpen(false);
                          }}
                          className="btn btn-primary"
                          style={{ fontSize: "12px", padding: "6px 14px" }}
                        >
                          Apply to canvas ✨
                        </button>
                        <button
                          onClick={() => openSaveOutfitModal(true, msg.recommendedItems!.map((i) => i.id))}
                          className="btn btn-ghost"
                          style={{ fontSize: "12px", padding: "6px 14px" }}
                        >
                          Save outfit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "10px 16px", borderRadius: "16px 16px 16px 4px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", fontSize: "16px", letterSpacing: "4px", color: "var(--text-secondary)" }}>···</div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>}

            {/* Input */}
            {!showSessions && <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder="Ask your style assistant..."
                rows={1}
                style={{ flex: 1, resize: "none", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "8px 12px", fontSize: "13px", color: "var(--text-primary)", fontFamily: "inherit", outline: "none" }}
              />
              <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading} className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }}>
                →
              </button>
            </div>}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setChatOpen((o) => !o)}
          style={{ width: "52px", height: "52px", borderRadius: "50%", background: "var(--accent-color)", border: "none", cursor: "pointer", fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", transition: "transform 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          title="Style Assistant"
        >
          {chatOpen ? "×" : "✨"}
        </button>
      </div>
    </div>
  );
}

