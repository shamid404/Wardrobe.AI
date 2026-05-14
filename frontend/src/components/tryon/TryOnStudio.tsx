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

async function resolveImage(src: string | null): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  // Relative path like /static/defaults/... — fetch via browser proxy and convert to base64
  try {
    const res = await fetch(src);
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
  const [activeTab, setActiveTab] = useState<"studio" | "history" | "settings">("studio");
  const [settingsName, setSettingsName] = useState("");
  const router = useRouter();

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
        showToast("✓ Image processed! Fill in details and add.");
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
    showToast("🔄 Generating try-on...");

    try {
      const [resolvedTop, resolvedBottom, resolvedOuter, resolvedHeadwear, resolvedShoes] = await Promise.all([
        resolveImage(selected.top ? (selected.top.removedBg || selected.top.photo) : null),
        resolveImage(selected.bottom ? (selected.bottom.removedBg || selected.bottom.photo) : null),
        resolveImage(selected.outer ? (selected.outer.removedBg || selected.outer.photo) : null),
        resolveImage(selected.headwear ? (selected.headwear.removedBg || selected.headwear.photo) : null),
        resolveImage(selected.shoes ? (selected.shoes.removedBg || selected.shoes.photo) : null),
      ]);

      const payload: any = { avatar_image_base64: avatarImage };

      if (selected.top) {
        payload.top_image_base64 = resolvedTop;
        payload.top_name = selected.top.name;
      }
      if (selected.bottom) {
        payload.bottom_image_base64 = resolvedBottom;
        payload.bottom_name = selected.bottom.name;
      }
      if (selected.outer) {
        payload.outer_image_base64 = resolvedOuter;
        payload.outer_name = selected.outer.name;
      }
      if (selected.headwear) {
        payload.headwear_image_base64 = resolvedHeadwear;
        payload.headwear_name = selected.headwear.name;
      }
      if (selected.shoes) {
        payload.shoes_image_base64 = resolvedShoes;
        payload.shoes_name = selected.shoes.name;
      }
      if (selected.accessories.length > 0) {
        const resolvedAccs = await Promise.all(
          selected.accessories.map((a) => resolveImage(a.removedBg || a.photo))
        );
        payload.accessories = selected.accessories.map((a, i) => ({
          image_base64: resolvedAccs[i],
          name: a.name,
        }));
      }

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
          <a href="#" className={activeTab === "settings" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("settings"); }}>
            Settings
          </a>
        </div>
        <div className="header-user">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                      >
                        ✕
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
            <div style={{ padding: "32px", maxWidth: "520px" }}>
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
          )}

          {activeTab === "history" && (
            <div style={{ padding: "24px" }}>
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

      {/* TOAST */}
      {toast && (
        <div className="toast">
          <div className="toast-icon">✓</div> {toast}
        </div>
      )}
    </div>
  );
}

