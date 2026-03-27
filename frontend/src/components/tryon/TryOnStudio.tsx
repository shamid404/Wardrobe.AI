"use client";

import React, { useMemo, useRef, useState } from "react";

type CategoryKey = "top" | "bottom" | "outer" | "head";

type ClothingItem = {
  id: number;
  name: string;
  category: Exclude<CategoryKey, "head">;
  emoji: string;
  brand: string;
  size: string;
  photo: string | null;
  removedBg: string | null;
};

type SelectedState = {
  top: ClothingItem | null;
  outer: ClothingItem | null;
  bottom: ClothingItem | null;
  head: null;
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

export function TryOnStudio() {
  const INITIAL_WARDROBE: ClothingItem[] = useMemo(
    () => [
      {
        id: 1,
        name: "Silk Blouse",
        category: "top",
        emoji: "👚",
        brand: "Zara",
        size: "M",
        photo: null,
        removedBg: null,
      },
      {
        id: 2,
        name: "Cotton Tee",
        category: "top",
        emoji: "👕",
        brand: "H&M",
        size: "M",
        photo: null,
        removedBg: null,
      },
      {
        id: 3,
        name: "Knit Sweater",
        category: "top",
        emoji: "🧥",
        brand: "COS",
        size: "L",
        photo: null,
        removedBg: null,
      },
      {
        id: 4,
        name: "Linen Blazer",
        category: "outer",
        emoji: "🥼",
        brand: "Massimo",
        size: "M",
        photo: null,
        removedBg: null,
      },
      {
        id: 5,
        name: "Trench Coat",
        category: "outer",
        emoji: "🧥",
        brand: "Burberry",
        size: "M",
        photo: null,
        removedBg: null,
      },
      {
        id: 6,
        name: "Wool Trousers",
        category: "bottom",
        emoji: "👖",
        brand: "Uniqlo",
        size: "30",
        photo: null,
        removedBg: null,
      },
      {
        id: 7,
        name: "Midi Skirt",
        category: "bottom",
        emoji: "👗",
        brand: "Mango",
        size: "S",
        photo: null,
        removedBg: null,
      },
      {
        id: 8,
        name: "Slim Jeans",
        category: "bottom",
        emoji: "👖",
        brand: "Levi's",
        size: "32",
        photo: null,
        removedBg: null,
      },
    ],
    [],
  );

  const CATEGORIES = useMemo(
    () => [
      { key: "top" as const, label: "Tops", dotClass: "dot-top", tagClass: "tag-top", selectedClass: "selected-top" },
      { key: "outer" as const, label: "Outerwear", dotClass: "dot-outer", tagClass: "tag-outer", selectedClass: "selected-outer" },
      { key: "bottom" as const, label: "Bottoms", dotClass: "dot-bottom", tagClass: "tag-bottom", selectedClass: "selected-bottom" },
    ],
    [],
  );

  const [wardrobe, setWardrobe] = useState<ClothingItem[]>(INITIAL_WARDROBE);
  const [selected, setSelected] = useState<SelectedState>({
    top: null,
    outer: null,
    bottom: null,
    head: null,
  });
  const [uploadModal, setUploadModal] = useState(false);
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
    emoji: "👕",
  });
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [tryOnResultImage, setTryOnResultImage] = useState<string | null>(null);

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
        const { removedDataUrl, meta } = await removeBackground(dataUrl, (step) => {
          console.log("Background removal step:", step);
        });

        setRemovedBgImage(removedDataUrl);
        if (meta?.category) {
          setItemForm((prev) => ({ ...prev, category: meta.category as ClothingItem["category"] }));
        }
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

  const handleAddItem = () => {
    if (!previewImage) {
      showToast("Select image first");
      return;
    }
    if (!itemForm.name.trim()) {
      showToast("Enter item name");
      return;
    }

    const newItem: ClothingItem = {
      id: Math.floor(Math.random() * 1_000_000),
      name: itemForm.name,
      category: itemForm.category,
      emoji: itemForm.emoji,
      brand: itemForm.brand,
      size: itemForm.size,
      photo: previewImage,
      removedBg: removedBgImage,
    };

    setWardrobe([...wardrobe, newItem]);
    showToast("✓ Item added!");
    setUploadModal(false);
    setPreviewImage(null);
    setRemovedBgImage(null);
    setProcessingImage(false);
    setItemForm({ name: "", category: "top", brand: "", size: "M", emoji: "👕" });
  };

  const toggleItem = (item: ClothingItem) => {
    setSelected((prev) => ({
      ...prev,
      [item.category]: prev[item.category]?.id === item.id ? null : item,
    }));
  };

  const deleteItem = (itemId: number) => {
    setWardrobe(wardrobe.filter((item) => item.id !== itemId));
    setSelected((prev) => {
      const updated = { ...prev };
      (Object.keys(updated) as (keyof SelectedState)[]).forEach((cat) => {
        // head is always null in this UI
        if (cat === "head") return;
        if ((updated as any)[cat]?.id === itemId) (updated as any)[cat] = null;
      });
      return updated;
    });
    showToast("✓ Item deleted");
  };

  const selectedOutfit = Object.values(selected).filter(Boolean) as ClothingItem[];

  const generateTryOn = async () => {
    if (!avatarImage) {
      showToast("Upload your body photo first");
      return;
    }
    if (!selected.top && !selected.bottom && !selected.outer) {
      showToast("Select items first");
      return;
    }

    const topBase64 = selected.top ? selected.top.removedBg || selected.top.photo : null;
    const bottomBase64 = selected.bottom
      ? selected.bottom.removedBg || selected.bottom.photo
      : null;
    const outerBase64 = selected.outer ? selected.outer.removedBg || selected.outer.photo : null;

    // Default wardrobe items have emoji only (no images), so generation would fail.
    if (selected.top && !topBase64) {
      showToast("Upload photo for TOP item");
      return;
    }
    if (selected.bottom && !bottomBase64) {
      showToast("Upload photo for BOTTOM item");
      return;
    }
    if (selected.outer && !outerBase64) {
      showToast("Upload photo for OUTER item");
      return;
    }

    setTryOnState("loading");
    setTryOnResultImage(null);
    showToast("🔄 Generating try-on...");

    try {
      const payload: any = { avatar_image_base64: avatarImage };

      if (selected.top) {
        payload.top_image_base64 = topBase64;
        payload.top_name = selected.top.name;
      }
      if (selected.bottom) {
        payload.bottom_image_base64 = bottomBase64;
        payload.bottom_name = selected.bottom.name;
      }
      if (selected.outer) {
        payload.outer_image_base64 = outerBase64;
        payload.outer_name = selected.outer.name;
      }

      const response = await fetch("/generate-tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        setTryOnResultImage(result.preview_image_data_url || result.preview_url);
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
    <div className="app">
      {/* HEADER */}
      <div className="header">
        <div className="header-logo">
          WARDROBE<span>.AI</span>
        </div>
        <div className="header-nav">
          <a href="#" className="active">
            Studio
          </a>
          <a href="#">History</a>
          <a href="#">Settings</a>
        </div>
        <div className="header-user">
          <span>Dinmukhammed</span>
          <div className="avatar">D</div>
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
                        (selected as any)[cat.key]?.id === item.id ? cat.selectedClass : ""
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
                          item.emoji
                        )}
                      </div>
                      <div className="card-body">
                        <div className="card-name">{item.name}</div>
                        <div className="card-meta">{item.brand || "Custom"}</div>
                      </div>
                    </div>
                  ))}
                <div className="card-add" onClick={() => setUploadModal(true)}>
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
              {selectedOutfit.map((item) => (
                <div
                  key={item.id}
                  className={`outfit-tag ${
                    item.category === "top" ? "tag-top" : item.category === "bottom" ? "tag-bottom" : "tag-outer"
                  }`}
                >
                  {item.emoji} {item.name?.substring(0, 10)}
                  <span className="tag-remove" onClick={() => setSelected((p) => ({ ...p, [item.category]: null } as any))}>
                    ×
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CANVAS */}
      <div className="main">
        <div className="main-toolbar">
          <div className="toolbar-title">Virtual Try-On Studio</div>
          <div className="toolbar-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setSelected({ top: null, outer: null, bottom: null, head: null })}
            >
              Clear
            </button>
            <button className="btn btn-primary" disabled={selectedOutfit.length === 0} onClick={generateTryOn}>
              {tryOnState === "loading" ? "🔄 Generating..." : "Generate Try-On"}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowRightPanel(!showRightPanel)} title="Toggle panel">
              {showRightPanel ? "▶" : "◀"}
            </button>
          </div>
        </div>

        <div className="canvas-area">
          {selectedOutfit.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👗</div>
              <div className="empty-title">Select Items to Try</div>
              <div className="empty-sub">Choose clothing from the left to see your virtual try-on</div>
            </div>
          ) : (
            <div className="avatar-stage">
              <div className={`avatar-frame ${tryOnState === "loading" ? "scanning" : ""}`}>
                {tryOnState === "loading" && <div className="scan-line"></div>}
                <div className="avatar-body">
                  <div className="avatar-head">
                    {/* head feature not implemented in this UI */}
                  </div>
                  <div className="avatar-torso">
                    {selected.top && (
                      <div className="avatar-top-img visible">
                        {selected.top.removedBg ? (
                          <img src={selected.top.removedBg} style={{ height: "100%", objectFit: "contain" }} />
                        ) : (
                          <div style={{ fontSize: "40px" }}>{selected.top.emoji}</div>
                        )}
                      </div>
                    )}
                    {selected.outer && (
                      <div className="avatar-outer-img visible">
                        {selected.outer.removedBg ? (
                          <img src={selected.outer.removedBg} style={{ height: "100%", objectFit: "contain" }} />
                        ) : (
                          <div style={{ fontSize: "38px" }}>{selected.outer.emoji}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="avatar-legs">
                    <div className="avatar-leg"></div>
                    <div className="avatar-leg"></div>
                    {selected.bottom && (
                      <div className="avatar-bottom-img visible">
                        {selected.bottom.removedBg ? (
                          <img src={selected.bottom.removedBg} style={{ height: "100%", objectFit: "contain" }} />
                        ) : (
                          <div style={{ fontSize: "32px", position: "absolute", bottom: "5px" }}>{selected.bottom.emoji}</div>
                        )}
                      </div>
                    )}
                  </div>
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
          )}
        </div>
      </div>

      {/* SIDEBAR RIGHT */}
      {showRightPanel && (
        <div className="sidebar-right">
          <div>
            <div className="panel-title">Your Body Photo</div>
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

          <div>
            <div className="panel-title">Upload Clothing</div>
            <button className="upload-btn" onClick={() => setUploadModal(true)} style={{ marginBottom: "16px" }}>
              📸 Upload Photo
            </button>
          </div>

          {selectedOutfit.length > 0 && (
            <div>
              <div className="panel-title">Using Items</div>
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
                      <div style={{ fontSize: "32px", textAlign: "center" }}>
                        {selected.top?.emoji} {selected.bottom?.emoji} {selected.outer?.emoji}
                      </div>
                    )}
                  </div>

                  <div className="score-row">
                    <span className="score-label">Fit Score</span>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: "85%" }}></div>
                    </div>
                    <span className="score-num">85</span>
                  </div>
                  <div className="score-row">
                    <span className="score-label">Style Score</span>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: "92%" }}></div>
                    </div>
                    <span className="score-num">92</span>
                  </div>
                  <div className="score-row">
                    <span className="score-label">Confidence</span>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: "88%" }}></div>
                    </div>
                    <span className="score-num">88</span>
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setTryOnState(null);
                  setTryOnResultImage(null);
                }}
                style={{ width: "100%", marginTop: "10px" }}
              >
                Clear Result
              </button>
            </div>
          )}
        </div>
      )}

      {/* UPLOAD MODAL */}
      {uploadModal && (
        <div
          className="modal-bg"
          onClick={() => {
            if (!processingImage) setUploadModal(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add Clothing Item</div>
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
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={itemForm.category}
                onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value as any }))}
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="outer">Outerwear</option>
              </select>
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
                onClick={() => {
                  setUploadModal(false);
                  setPreviewImage(null);
                  setRemovedBgImage(null);
                  setProcessingImage(false);
                  setItemForm({ name: "", category: "top", brand: "", size: "M", emoji: "👕" });
                }}
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

