"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearAuth, getUser, saveUser, authHeaders } from "@/lib/auth";

type CategoryKey = "top" | "bottom" | "outer" | "headwear" | "shoes" | "accessory";

type ClothingItem = {
  id: string;
  name: string;
  category: CategoryKey;
  brand: string;
  size: string;
  color: string;
  season: string;
  photo: string | null;
  removedBg: string | null;
};

const COLOR_HEX: Record<string, string> = {
  White: "#F5F5F5", Black: "#2a2a2a", Grey: "#9E9E9E", Navy: "#1a237e",
  Blue: "#2196F3", Green: "#4CAF50", Red: "#F44336", Pink: "#E91E63",
  Yellow: "#FFC107", Orange: "#FF9800", Purple: "#9C27B0", Brown: "#795548",
  Beige: "#D4C5A9", Multicolor: "linear-gradient(135deg,#ff6b6b,#feca57,#48dbfb,#ff9ff3)",
};
const COLORS = Object.keys(COLOR_HEX);
const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "All seasons"];
const SEASON_ICON: Record<string, string> = {
  Spring: "Spr", Summer: "Sum", Autumn: "Aut", Winter: "Win", "All seasons": "All",
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

    const removeRes = await fetch("/remove-background", { method: "POST", body: formData, headers: authHeaders() });
    if (removeRes.status === 401) {
      clearAuth();
      const e = new Error("UNAUTHORIZED") as Error & { code: string };
      e.code = "UNAUTHORIZED";
      throw e;
    }
    if (!removeRes.ok) {
      const errData = await removeRes.json().catch(() => ({}));
      throw new Error(errData.detail || `Remove BG failed: ${removeRes.statusText}`);
    }

    const result = await removeRes.json();
    onStep?.("done");

    return {
      removedDataUrl: result.removed_bg as string,
      clothingInfo: result.clothing_info ?? null,
    };
  } catch (err) {
    console.error("Background removal error:", err);
    throw err;
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
    color: "",
    season: "",
  });
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [tryOnResultImage, setTryOnResultImage] = useState<string | null>(null);
  const [userName, setUserName] = useState("User");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [topAbove, setTopAbove] = useState(true);
  const [tryOnHistory, setTryOnHistory] = useState<TryOnHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"studio" | "history" | "outfits" | "settings">("studio");
  const [chatOpen, setChatOpen] = useState(false);
  const [editItem, setEditItem] = useState<ClothingItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "top" as CategoryKey, color: "", season: "" });
  const [filterColor, setFilterColor] = useState("");
  const [filterSeason, setFilterSeason] = useState("");
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingOut, setDeletingOut] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const [showTour, setShowTour] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("wardrobe_tour_done_v1")) {
      const t = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

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

  const filteredWardrobe = useMemo(
    () => wardrobe.filter((item) =>
      (!filterColor || item.color === filterColor) &&
      (!filterSeason || item.season === filterSeason || item.season === "All seasons")
    ),
    [wardrobe, filterColor, filterSeason],
  );

  const openEditModal = (item: ClothingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditItem(item);
    setEditForm({ name: item.name, category: item.category, color: item.color || "", season: item.season || "" });
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
      const patch = { name: updated.name, category: updated.category as CategoryKey, color: updated.color || "", season: updated.season || "" };
      setWardrobe((prev) => prev.map((w) => w.id === editItem.id ? { ...w, ...patch } : w));
      setSelected((prev) => {
        const newSel = { ...prev };
        (Object.keys(newSel) as (keyof SelectedState)[]).forEach((key) => {
          if (key === "accessories") {
            newSel.accessories = newSel.accessories.map((a) => a.id === editItem.id ? { ...a, ...patch } : a);
          } else if ((newSel[key] as ClothingItem | null)?.id === editItem.id) {
            (newSel as any)[key] = { ...(newSel[key] as ClothingItem), ...patch };
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
    if (user?.avatar_url) setUserAvatarUrl(user.avatar_url);
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
    fetch("/history", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((items: { job_id: string; preview_url: string; created_at: string }[]) => {
        setTryOnHistory(items.map((item) => ({
          id: item.job_id,
          image: item.preview_url,
          outfit: [],
          timestamp: new Date(item.created_at),
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/wardrobe", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((items: Array<{ id: string; name: string; category: string; brand: string; size: string; color: string | null; season: string | null; image_url: string | null }>) => {
        setWardrobe(items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category as CategoryKey,
          brand: i.brand || "",
          size: i.size || "",
          color: i.color || "",
          season: i.season || "",
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

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        showToast(`❌ ${data.detail || "Failed to delete account"}`);
        return;
      }
      clearAuth();
      setShowDeleteConfirm(false);
      setDeleteLoading(false);
      setDeletingOut(true);
      setTimeout(() => router.replace("/login"), 900);
      return;
    } catch {
      showToast("❌ Server error. Try again.");
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
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
        const { removedDataUrl, clothingInfo } = await removeBackground(dataUrl, (step) => {
          console.log("Background removal step:", step);
        });

        setRemovedBgImage(removedDataUrl);

        if (clothingInfo) {
          setItemForm((p) => ({
            ...p,
            name: clothingInfo.name || p.name,
            category: (clothingInfo.category as ClothingItem["category"]) || p.category,
            color: clothingInfo.color || p.color,
            season: clothingInfo.season || p.season,
          }));
        }

        showToast("✓ Done! Check details and add.");
        setProcessingImage(false);
      } catch (err: any) {
        if (err?.code === "UNAUTHORIZED" || err?.message === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        console.error("Error processing image:", err);
        showToast(`❌ ${err?.message || "Error processing image"}`);
        setPreviewImage(null);
        setRemovedBgImage(null);
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
    setItemForm({ name: "", category: "top", color: "", season: "" });
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
          color: itemForm.color || null,
          season: itemForm.season || null,
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
        color: created.color || "",
        season: created.season || "",
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

      const itemLabel = (item: ClothingItem | null, label: string) =>
        item ? (item.color ? `${item.color.toLowerCase()} ${label}` : label) : undefined;

      const payload: any = {
        avatar_image_base64: avatarImage,
        outfit_collage_base64: outfitCollage,
        top_name: itemLabel(selected.top, "top"),
        bottom_name: itemLabel(selected.bottom, "bottom"),
        outer_name: itemLabel(selected.outer, "outerwear"),
        headwear_name: itemLabel(selected.headwear, "headwear"),
        shoes_name: itemLabel(selected.shoes, "shoes"),
        accessories: selected.accessories.map((a) => ({
          name: a.color ? `${a.color.toLowerCase()} accessory` : "accessory",
        })),
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

  const handleTourDone = () => {
    localStorage.setItem("wardrobe_tour_done_v1", "1");
    setShowTour(false);
  };

  return (
    <div className={`app${showRightPanel ? "" : " panel-collapsed"}`}>
      {/* HEADER */}
      <div className="header">
        <div className="header-logo">
          WARDROBE<span>.AI</span>
        </div>
        <div className="header-nav" id="tour-tabs">
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
          <div className="avatar" style={{ overflow: "hidden", padding: 0 }}>
            {userAvatarUrl
              ? <img src={userAvatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : userName[0]?.toUpperCase()}
          </div>
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
      <div className="sidebar-left" id="tour-wardrobe">
        {/* Filter bar */}
        <div style={{ padding: "10px 12px 4px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "6px" }}>
            {COLORS.map((c) => (
              <div
                key={c}
                title={c}
                onClick={() => setFilterColor(filterColor === c ? "" : c)}
                style={{
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: COLOR_HEX[c],
                  border: filterColor === c ? "2px solid var(--accent-color)" : "1.5px solid rgba(0,0,0,0.12)",
                  cursor: "pointer",
                  transform: filterColor === c ? "scale(1.25)" : "scale(1)",
                  transition: "transform 0.1s",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {SEASONS.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSeason(filterSeason === s ? "" : s)}
                style={{
                  fontSize: "10px", padding: "2px 7px", borderRadius: "20px",
                  border: "1px solid var(--border-subtle)",
                  background: filterSeason === s ? "var(--accent-color)" : "transparent",
                  color: filterSeason === s ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <div className="category-section">
              <div className="category-header">
                <div className="category-label">
                  <div className={`category-dot ${cat.dotClass}`}></div>
                  {cat.label}
                </div>
                <div className="category-count">{filteredWardrobe.filter((w) => w.category === cat.key).length}/{wardrobe.filter((w) => w.category === cat.key).length}</div>
              </div>
              <div className="h-scroll-track">
                {filteredWardrobe
                  .filter((w) => w.category === cat.key)
                  .map((item, i) => (
                    <div
                      key={item.id}
                      className={`card-item ${
                        cat.key === "accessory"
                          ? selected.accessories.some((a) => a.id === item.id) ? cat.selectedClass : ""
                          : (selected as any)[cat.key]?.id === item.id ? cat.selectedClass : ""
                      }`}
                      onClick={() => toggleItem(item)}
                      title={item.name}
                      style={{ animation: "cardEnter 0.32s cubic-bezier(0.34,1.1,0.64,1) both", animationDelay: `${Math.min(i, 9) * 50}ms` }}
                    >
                      <div className="card-check">
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="10 3 5 9 2 6"/></svg>
                      </div>
                      <div
                        className="card-delete"
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                      >
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>
                      </div>
                      <div
                        onClick={(e) => openEditModal(item, e)}
                        style={{ position: "absolute", top: "6px", left: "6px", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2, opacity: 0, transition: "opacity 0.2s" }}
                        className="card-edit-btn"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </div>
                      <div className="card-thumb">
                        {item.removedBg ? (
                          <img src={item.removedBg} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : item.photo ? (
                          <img src={item.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ opacity: 0.25, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </div>
                        )}
                      </div>
                      <div className="card-body">
                        <div className="card-name">{item.name}</div>
                        <div className="card-meta" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {item.color && COLOR_HEX[item.color] && (
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLOR_HEX[item.color], border: "1px solid rgba(0,0,0,0.15)", flexShrink: 0, display: "inline-block" }} title={item.color} />
                          )}
                          {item.brand || "Custom"}
                          {item.season && item.season !== "All seasons" && (
                            <span style={{ marginLeft: "3px", fontSize: "9px", fontWeight: 500, color: "var(--text-tertiary)", letterSpacing: "0.03em" }} title={item.season}>
                              {item.season.slice(0, 3).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                <div className="card-add" onClick={() => openUploadModal(cat.key)}>
                  <div className="card-add-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
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
              {tryOnState === "loading"
                ? <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><svg style={{ animation: "spin 0.8s linear infinite" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>Generating…</span>
                : <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>Generate outfit</span>
              }
            </button>
            <button className="btn btn-ghost" onClick={() => setShowRightPanel(!showRightPanel)} title="Toggle panel" style={{ padding: "10px 12px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showRightPanel ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}
              </svg>
            </button>
          </div>
        </div>

        <div className="canvas-area" id="tour-canvas">
          {activeTab === "settings" && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "32px" }}>
            <div style={{ maxWidth: "520px" }}>
              <div style={{ marginBottom: "32px" }}>
                <div className="panel-title" style={{ marginBottom: "16px" }}>Profile</div>
                <div className="analysis-card">
                  {/* Avatar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
                    <div style={{ width: "72px", height: "72px", borderRadius: "50%", overflow: "hidden", background: "var(--bg-secondary)", border: "2px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>
                      {userAvatarUrl
                        ? <img src={userAvatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : userName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600, marginBottom: "6px" }}>{userName}</div>
                      <label style={{ cursor: "pointer" }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append("file", file);
                            try {
                              const res = await fetch("/api/auth/avatar", { method: "POST", headers: authHeaders(), body: fd });
                              if (!res.ok) throw new Error();
                              const updated = await res.json();
                              setUserAvatarUrl(updated.avatar_url);
                              const currentUser = getUser();
                              if (currentUser) saveUser({ ...currentUser, avatar_url: updated.avatar_url });
                              showToast("✓ Avatar updated");
                            } catch {
                              showToast("❌ Failed to upload avatar");
                            }
                            e.target.value = "";
                          }}
                        />
                        <span className="btn btn-ghost" style={{ fontSize: "12px", pointerEvents: "none" }}>
                          Change photo
                        </span>
                      </label>
                    </div>
                  </div>
                  {/* Name */}
                  <div>
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
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      Try-on history <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>({tryOnHistory.length} items)</span>
                    </span>
                    <button
                      className="btn btn-ghost"
                      disabled={tryOnHistory.length === 0}
                      onClick={async () => {
                        await fetch("/history", { method: "DELETE", headers: authHeaders() });
                        setTryOnHistory([]);
                        showToast("✓ History cleared");
                      }}
                      style={{ fontSize: "11px" }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                      Wardrobe <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>({wardrobe.length} items)</span>
                    </span>
                    <button
                      className="btn btn-ghost"
                      disabled={wardrobe.length === 0}
                      onClick={() => { setWardrobe([]); setSelected({ top: null, outer: null, bottom: null, headwear: null, shoes: null, accessories: [] }); showToast("✓ Wardrobe cleared"); }}
                      style={{ fontSize: "11px" }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>Onboarding tour</span>
                    <button
                      className="btn btn-ghost"
                      onClick={() => { localStorage.removeItem("wardrobe_tour_done_v1"); setShowTour(true); showToast("✓ Tour reset"); }}
                      style={{ fontSize: "11px" }}
                    >
                      Replay
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "32px" }}>
                <div className="panel-title" style={{ marginBottom: "16px", color: "#b85858" }}>Danger Zone</div>
                <div className="analysis-card" style={{ border: "1px solid rgba(184,88,88,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "3px" }}>Delete Account</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Permanently remove your account and all data</div>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{ flexShrink: 0, padding: "7px 16px", borderRadius: "8px", border: "1px solid rgba(184,88,88,0.5)", background: "transparent", color: "#b85858", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(184,88,88,0.08)"; e.currentTarget.style.borderColor = "#b85858"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(184,88,88,0.5)"; }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}

          {activeTab === "outfits" && (
            savedOutfits.length === 0 ? (
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><path d="M9 8h1m4 0h1M9 16h1m4 0h1"/></svg>}
              title="No Saved Outfits"
              sub='Select items on the canvas and click "Save outfit"'
            />
            ) : (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
                {savedOutfits.map((outfit) => (
                  <div key={outfit.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "12px", background: "var(--bg-secondary)", minHeight: "80px" }}>
                      {outfit.items.slice(0, 4).map((oi) => (
                        <div key={oi.item_id} style={{ width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {oi.image_url ? (
                            <img src={oi.image_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : (
                            <div style={{ opacity: 0.2, display: "flex" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
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
                          <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 6px", borderRadius: "20px", background: "linear-gradient(135deg, #7c6fa0, #d4af37)", color: "#fff" }}>AI</span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                        {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""} · {outfit.created_at}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-primary" style={{ flex: 1, fontSize: "12px" }} onClick={() => loadOutfit(outfit)}>Wear it</button>
                        <button className="btn btn-ghost" style={{ fontSize: "12px", padding: "6px 10px" }} onClick={() => deleteOutfit(outfit.id)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {activeTab === "history" && (
            tryOnHistory.length === 0 ? (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                title="No History Yet"
                sub="Generated try-ons will appear here"
              />
              ) : (
              <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                  {tryOnHistory.map((item) => (
                    <div key={item.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)" }}>
                      <img src={item.image} style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "3/4" }} />
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: "13px", marginBottom: "4px", color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.outfit.map((o) => o.name).join(", ")}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                          {item.timestamp.toLocaleDateString()} · {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <button className="btn btn-ghost" onClick={() => downloadImage(item.image)} style={{ width: "100%", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
          {activeTab === "studio" && (selectedOutfit.length === 0 ? (
            <EmptyState
              icon={<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>}
              title="Select Items to Try"
              sub="Choose clothing from the left to see your virtual try-on"
            />
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
                        <div className="flatlay-emoji"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{ opacity: 0.25 }}><path d="M2 19c0-3.5 4.5-6 10-6s10 2.5 10 6M12 13V7a4 4 0 00-4-4"/></svg></div>
                      )}
                      <div className="flatlay-label">Headwear: {selected.headwear.name}</div>
                    </div>
                  )}

                  {selected.top && (
                    <div
                      className="flatlay-item flatlay-top"
                      style={{
                        zIndex: topAbove ? 2 : 1,
                        cursor: selected.outer ? "pointer" : "default",
                        transform: selected.outer ? (topAbove ? "scale(1) translate(0px, 0px)" : "scale(0.96) translate(6px, 10px)") : undefined,
                        opacity: selected.outer ? (topAbove ? 1 : 0.72) : undefined,
                        boxShadow: selected.outer ? (topAbove ? "0 8px 28px rgba(0,0,0,0.18)" : "none") : undefined,
                        transition: "transform 0.55s cubic-bezier(0.34,1.1,0.64,1), opacity 0.4s ease, box-shadow 0.4s ease",
                      }}
                      onClick={() => selected.outer && setTopAbove((p) => !p)}
                      title={selected.outer ? "Click to swap layer" : undefined}
                    >
                      {selected.top.removedBg || selected.top.photo ? (
                        <img src={selected.top.removedBg || selected.top.photo!} alt={selected.top.name} />
                      ) : (
                        <div className="flatlay-emoji"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/></svg></div>
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
                        transform: !topAbove ? "scale(1) translate(0px, 0px)" : "scale(0.96) translate(-6px, 10px)",
                        opacity: !topAbove ? 1 : 0.72,
                        boxShadow: !topAbove ? "0 8px 28px rgba(0,0,0,0.18)" : "none",
                        transition: "transform 0.55s cubic-bezier(0.34,1.1,0.64,1), opacity 0.4s ease, box-shadow 0.4s ease",
                      }}
                      onClick={() => selected.top && setTopAbove((p) => !p)}
                      title={selected.top ? "Click to swap layer" : undefined}
                    >
                      {selected.outer.removedBg || selected.outer.photo ? (
                        <img src={selected.outer.removedBg || selected.outer.photo!} alt={selected.outer.name} />
                      ) : (
                        <div className="flatlay-emoji"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.86H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.86l.58-3.57a2 2 0 00-1.34-2.23z"/><line x1="12" y1="2" x2="12" y2="21"/></svg></div>
                      )}
                      <div className="flatlay-label">Outerwear: {selected.outer.name}</div>
                    </div>
                  )}

                  {selected.bottom && (
                    <div className="flatlay-item flatlay-bottom">
                      {selected.bottom.removedBg || selected.bottom.photo ? (
                        <img src={selected.bottom.removedBg || selected.bottom.photo!} alt={selected.bottom.name} />
                      ) : (
                        <div className="flatlay-emoji"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><path d="M6 2h12l2 8-4 12H8L4 10l2-8z"/><line x1="12" y1="2" x2="12" y2="22"/></svg></div>
                      )}
                      <div className="flatlay-label">Bottoms: {selected.bottom.name}</div>
                    </div>
                  )}

                  {selected.shoes && (
                    <div className="flatlay-item flatlay-shoes">
                      {selected.shoes.removedBg || selected.shoes.photo ? (
                        <img src={selected.shoes.removedBg || selected.shoes.photo!} alt={selected.shoes.name} />
                      ) : (
                        <div className="flatlay-emoji"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><path d="M2 18l1-9 4-1 3 5 5-5 5 1 1 9H2z"/></svg></div>
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
                            <div className="flatlay-emoji"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg></div>
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
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Upload Body Photo
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
                    <span className="analysis-val">{selected.outer.name?.substring(0, 12)}</span>
                  </div>
                )}
                {selected.headwear && (
                  <div className="analysis-row">
                    <span className="analysis-key">Headwear</span>
                    <span className="analysis-val">{selected.headwear.name?.substring(0, 12)}</span>
                  </div>
                )}
                {selected.shoes && (
                  <div className="analysis-row">
                    <span className="analysis-key">Shoes</span>
                    <span className="analysis-val">{selected.shoes.name?.substring(0, 12)}</span>
                  </div>
                )}
                {selected.accessories.length > 0 && (
                  <div className="analysis-row">
                    <span className="analysis-key">Accessories</span>
                    <span className="analysis-val">{selected.accessories.length} item{selected.accessories.length !== 1 ? "s" : ""}</span>
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
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

      {/* DELETE ACCOUNT CONFIRM MODAL */}
      {showDeleteConfirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
          onClick={() => { if (!deleteLoading) setShowDeleteConfirm(false); }}
        >
          <div
            style={{ background: "var(--bg-primary, #1a1a2e)", border: "1px solid rgba(184,88,88,0.35)", borderRadius: "16px", padding: "32px 28px", maxWidth: "380px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b85858" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "inherit" }}>
                Are you sure?
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary, #9090a0)", lineHeight: 1.6, marginBottom: "24px" }}>
              This action is <strong style={{ color: "#b85858" }}>irreversible</strong>. Your account, wardrobe, try-on history, and chats will be permanently deleted.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, rgba(255,255,255,0.12))", background: "transparent", color: "var(--text-secondary, #9090a0)", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: deleteLoading ? "rgba(184,88,88,0.4)" : "#b85858", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: deleteLoading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s" }}
              >
                {deleteLoading ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <div className="pd-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
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
              <label className="form-label">Color</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {COLORS.map((c) => (
                  <div
                    key={c}
                    title={c}
                    onClick={() => setItemForm((p) => ({ ...p, color: p.color === c ? "" : c }))}
                    style={{
                      width: "22px", height: "22px", borderRadius: "50%",
                      background: COLOR_HEX[c],
                      border: itemForm.color === c ? "2px solid var(--accent-color)" : "1.5px solid rgba(0,0,0,0.12)",
                      cursor: "pointer",
                      transform: itemForm.color === c ? "scale(1.2)" : "scale(1)",
                      transition: "transform 0.1s",
                    }}
                  />
                ))}
              </div>
              {itemForm.color && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{itemForm.color}</div>}
            </div>

            <div className="form-field">
              <label className="form-label">Season</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {SEASONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setItemForm((p) => ({ ...p, season: p.season === s ? "" : s }))}
                    style={{
                      fontSize: "11px", padding: "4px 10px", borderRadius: "20px",
                      border: "1px solid var(--border-subtle)",
                      background: itemForm.season === s ? "var(--accent-color)" : "transparent",
                      color: itemForm.season === s ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={closeUploadModal}
                disabled={processingImage}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddItem} disabled={!previewImage || !itemForm.name || processingImage} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                {processingImage
                  ? <><svg style={{ animation: "spin 0.8s linear infinite" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>Processing…</>
                  : "Add Item"
                }
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
                <div className="form-label">Color</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {COLORS.map((c) => (
                    <div
                      key={c}
                      title={c}
                      onClick={() => setEditForm((p) => ({ ...p, color: p.color === c ? "" : c }))}
                      style={{
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: COLOR_HEX[c],
                        border: editForm.color === c ? "2px solid var(--accent-color)" : "1.5px solid rgba(0,0,0,0.12)",
                        cursor: "pointer",
                        transform: editForm.color === c ? "scale(1.2)" : "scale(1)",
                        transition: "transform 0.1s",
                      }}
                    />
                  ))}
                </div>
                {editForm.color && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{editForm.color}</div>}
              </div>
              <div>
                <div className="form-label">Season</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, season: p.season === s ? "" : s }))}
                      style={{
                        fontSize: "11px", padding: "3px 9px", borderRadius: "20px",
                        border: "1px solid var(--border-subtle)",
                        background: editForm.season === s ? "var(--accent-color)" : "transparent",
                        color: editForm.season === s ? "#fff" : "var(--text-secondary)",
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button
                  className="btn btn-ghost"
                  style={{ marginRight: "auto", color: "var(--error, #e53e3e)", borderColor: "var(--error, #e53e3e)" }}
                  onClick={() => { deleteItem(editItem!.id); setEditItem(null); }}
                >
                  Delete
                </button>
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
          <div className="toast-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", background: toast.startsWith("❌") || toast.toLowerCase().startsWith("failed") || toast.toLowerCase().includes("error") ? "rgba(184,88,88,0.15)" : "rgba(107,158,114,0.15)", flexShrink: 0 }}>
            {toast.startsWith("❌") || toast.toLowerCase().startsWith("failed") || toast.toLowerCase().includes("error")
              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B85858" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6B9E72" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            }
          </div>
          {toast.replace(/^[❌✓🔄]\s?/, "")}
        </div>
      )}

      {/* FLOATING ASSISTANT */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px", pointerEvents: "none" }}>
          <div style={{ width: "360px", height: "520px", background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden", opacity: chatOpen ? 1 : 0, transform: chatOpen ? "translateY(0) scale(1)" : "translateY(18px) scale(0.93)", pointerEvents: chatOpen ? "all" : "none", transition: "opacity 0.28s ease, transform 0.35s cubic-bezier(0.34,1.2,0.64,1)", transformOrigin: "bottom right" }}>
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
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", animation: "slideInLeft 0.26s ease both" }}>
                <button onClick={startNewChat} style={{ margin: "12px 16px 4px", padding: "10px", background: "var(--accent-color)", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit", fontWeight: 600 }}>
                  + New chat
                </button>
                {chatSessions.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>No saved chats yet</div>
                ) : (
                  <div style={{ padding: "8px 0" }}>
                    {chatSessions.map((s, i) => (
                      <div key={s.id} onClick={() => loadChatSession(s.id)}
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", cursor: "pointer", background: s.id === currentSessionId ? "var(--bg-secondary)" : "transparent", borderLeft: s.id === currentSessionId ? "2px solid var(--accent-color)" : "2px solid transparent", animation: "slideInLeft 0.24s ease both", animationDelay: `${i * 40}ms` }}
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
            {!showSessions && <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", animation: "slideInRight 0.26s ease both" }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", marginTop: "24px" }}>
                  <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--bg-secondary, rgba(45,34,24,0.06))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-color)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    </div>
                  </div>
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
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "8px", animation: msg.role === "user" ? "msgFromUser 0.32s cubic-bezier(0.34,1.1,0.64,1) both" : "msgFromAI 0.32s cubic-bezier(0.34,1.1,0.64,1) both" }}>
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
                            showToast("Outfit applied to canvas");
                            setChatOpen(false);
                          }}
                          className="btn btn-primary"
                          style={{ fontSize: "12px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Apply to canvas
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
                <div style={{ display: "flex", justifyContent: "flex-start", animation: "msgFromAI 0.28s ease both" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", display: "flex", gap: "5px", alignItems: "center" }}>
                    {[0, 160, 320].map((delay) => (
                      <span key={delay} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-color)", display: "inline-block", animation: `typingBounce 1.1s ease infinite`, animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
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
              <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading} className="btn btn-primary" style={{ padding: "8px 14px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>}
          </div>

        {/* Toggle button */}
        <button
          id="tour-chat"
          onClick={() => setChatOpen((o) => !o)}
          style={{ width: "52px", height: "52px", borderRadius: "50%", background: "var(--accent-color)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", transition: "transform 0.2s, background 0.2s", pointerEvents: "auto" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.background = "var(--accent-hover, #B36F5A)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "var(--accent-color)"; }}
          title="Style Assistant"
        >
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.3s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s ease", transform: chatOpen ? "rotate(90deg) scale(1.05)" : "rotate(0deg) scale(1)" }}>
            {chatOpen
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            }
          </span>
        </button>
      </div>
      {deletingOut && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "var(--bg-primary)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px",
          animation: "fadeIn 0.5s ease both",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
          <div style={{ fontFamily: "var(--font-playfair,'Playfair Display',serif)", fontSize: "18px", color: "var(--text-secondary)", opacity: 0.5 }}>Account deleted</div>
        </div>
      )}
      {showTour && <OnboardingTour onDone={handleTourDone} />}
    </div>
  );
}

// ─── OnboardingTour ──────────────────────────────────────────────
const TOUR_STEPS = [
  {
    id: "tour-wardrobe",
    title: "Your Wardrobe",
    sub: "All your clothes live here. Filter by category, color, or season — then click any item to add it to the canvas.",
    pos: "right" as const,
  },
  {
    id: "tour-canvas",
    title: "Try-On Canvas",
    sub: "Compose your outfit here. Add items from the left, then click Try On to see the virtual try-on result.",
    pos: "left" as const,
  },
  {
    id: "tour-tabs",
    title: "Studio · History · Outfits",
    sub: "Switch between your workspace, past try-on results, and saved outfits using the navigation above.",
    pos: "bottom" as const,
  },
  {
    id: "tour-chat",
    title: "AI Stylist",
    sub: "Your personal fashion advisor. Ask for outfit ideas, weather-based suggestions, and styling tips anytime.",
    pos: "left" as const,
  },
];

function OnboardingTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const [mounted, setMounted] = useState(false);

  // SVG refs — animated directly via setAttribute, no React re-renders during animation
  const maskHoleRef = useRef<SVGRectElement | null>(null);
  const glowRef = useRef<SVGRectElement | null>(null);
  const rafRef = useRef(0);
  const animPos = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const initialized = useRef(false);

  useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    update();
    window.addEventListener("resize", update);
    requestAnimationFrame(() => setMounted(true));
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!vw) return;
    const el = document.getElementById(TOUR_STEPS[step].id);
    if (!el) return;
    const PAD = 10;
    const r = el.getBoundingClientRect();
    setRect(r);

    const target = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };

    // Snap on first render, animate on subsequent steps
    if (!initialized.current) {
      animPos.current = { ...target };
      initialized.current = true;
      [maskHoleRef, glowRef].forEach(ref => {
        if (!ref.current) return;
        ref.current.setAttribute("x", String(target.x));
        ref.current.setAttribute("y", String(target.y));
        ref.current.setAttribute("width", String(target.w));
        ref.current.setAttribute("height", String(target.h));
      });
      return;
    }

    cancelAnimationFrame(rafRef.current);
    function tick() {
      const c = animPos.current;
      const EASE = 0.11;
      c.x += (target.x - c.x) * EASE;
      c.y += (target.y - c.y) * EASE;
      c.w += (target.w - c.w) * EASE;
      c.h += (target.h - c.h) * EASE;
      [maskHoleRef, glowRef].forEach(ref => {
        if (!ref.current) return;
        ref.current.setAttribute("x", String(c.x));
        ref.current.setAttribute("y", String(c.y));
        ref.current.setAttribute("width", String(c.w));
        ref.current.setAttribute("height", String(c.h));
      });
      const done = Math.abs(c.x - target.x) < 0.4 && Math.abs(c.y - target.y) < 0.4 && Math.abs(c.w - target.w) < 0.4 && Math.abs(c.h - target.h) < 0.4;
      if (!done) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, vw, vh]);

  if (!vw) return null;

  const PAD = 10;
  const R = 14;
  const TW = 284;
  let tx = 0, ty = 0;
  if (rect) {
    const sx = rect.left - PAD, sy = rect.top - PAD, sw = rect.width + PAD * 2, sh = rect.height + PAD * 2;
    const { pos } = TOUR_STEPS[step];
    if (pos === "right")       { tx = sx + sw + 20; ty = sy + sh / 2 - 90; }
    else if (pos === "left")   { tx = sx - TW - 20; ty = sy + sh / 2 - 90; }
    else if (pos === "bottom") { tx = sx + sw / 2 - TW / 2; ty = sy + sh + 20; }
    else                       { tx = sx + sw / 2 - TW / 2; ty = sy - 200; }
    tx = Math.max(16, Math.min(vw - TW - 16, tx));
    ty = Math.max(16, Math.min(vh - 210, ty));
  }

  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "all", opacity: mounted ? 1 : 0, transition: "opacity 0.45s ease" }}>
      {/* SVG spotlight — rects updated by RAF, not React */}
      <svg width={vw} height={vh} style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}>
        <defs>
          <mask id="tour-mask">
            <rect width={vw} height={vh} fill="white" />
            <rect ref={maskHoleRef} rx={R} ry={R} fill="black" />
          </mask>
        </defs>
        <rect width={vw} height={vh} fill="rgba(10,7,4,0.80)" mask="url(#tour-mask)" />
        <rect ref={glowRef} rx={R} ry={R} fill="none"
          stroke="#C8826D" strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 12px rgba(200,130,109,0.75))" }}
        />
      </svg>

      {/* Tooltip — key=step triggers remount → spring animation on each step */}
      {rect && (
        <div
          key={step}
          style={{
            position: "absolute", left: tx, top: ty, width: TW,
            background: "var(--surface, #FEFAF6)",
            borderRadius: "18px",
            padding: "22px 22px 18px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,130,109,0.25)",
            animation: "tourPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
            pointerEvents: "all",
            zIndex: 9999,
          }}
        >
          <div style={{ display: "flex", gap: "5px", marginBottom: "16px" }}>
            {TOUR_STEPS.map((_, i) => (
              <div key={i} style={{
                height: "5px",
                width: i === step ? "22px" : "5px",
                borderRadius: "3px",
                background: i <= step ? "#C8826D" : "var(--border-subtle, #E8DDD3)",
                transition: "all 0.35s ease",
              }} />
            ))}
          </div>

          <div style={{ fontFamily: "var(--font-playfair,'Playfair Display',serif)", fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: "8px" }}>
            {TOUR_STEPS[step].title}
          </div>
          <div style={{ fontFamily: "var(--font-inter,'Inter',sans-serif)", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: "18px" }}>
            {TOUR_STEPS[step].sub}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", opacity: 0.6, fontFamily: "var(--font-inter,'Inter',sans-serif)" }}>
              {step + 1} / {TOUR_STEPS.length}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={onDone} style={{ background: "none", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "7px 13px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s, color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#C8826D"; e.currentTarget.style.color = "#C8826D"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                Skip
              </button>
              <button onClick={() => isLast ? onDone() : setStep(s => s + 1)}
                style={{ background: "#C8826D", border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, transform 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#B36F5A"; e.currentTarget.style.transform = "scale(1.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#C8826D"; e.currentTarget.style.transform = "scale(1)"; }}
              >
                {isLast ? "Got it!" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 0, animation: "fadeUp 0.5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "80px", height: "80px", borderRadius: "24px", background: "rgba(45,34,24,0.05)", marginBottom: "20px", color: "var(--text-primary)", opacity: 0.3 }}>
        {icon}
      </div>
      <div style={{ fontFamily: "var(--font-playfair,'Playfair Display',serif)", fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontFamily: "var(--font-inter,'Inter',sans-serif)", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: "260px" }}>
        {sub}
      </div>
    </div>
  );
}

