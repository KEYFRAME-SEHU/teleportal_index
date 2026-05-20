import * as THREE from "./three.module.js";

const statusNode = document.getElementById("status");
const hudNode = document.querySelector(".hud");
const sceneHost = document.getElementById("scene");
const tooltipNode = document.getElementById("tooltip");
const tooltipTitleNode = document.getElementById("tooltip-title");
const tooltipCopyNode = document.getElementById("tooltip-copy");
const previewTitleNode = document.getElementById("preview-title");
const previewCopyNode = document.getElementById("preview-copy");
const previewMuseumLinkNode = document.getElementById("preview-museum-link");
const previewWorldLinkNode = document.getElementById("preview-world-link");
const previewSnapshotNode = document.getElementById("preview-snapshot");
const previewSnapshotImageNode = document.getElementById("preview-snapshot-image");
const previewDetailsSectionNode = document.getElementById("preview-details-section");
const previewDetailsNode = document.getElementById("preview-details");
const previewLocationsSectionNode = document.getElementById("preview-locations-section");
const previewLocationsNode = document.getElementById("preview-locations");
const previewConnectedSectionNode = document.getElementById("preview-connected-section");
const previewConnectedNode = document.getElementById("preview-connected");
const sceneSearchForm = document.getElementById("scene-search-form");
const sceneSearchInput = document.getElementById("scene-search-input");
const searchResultsSectionNode = document.getElementById("search-results-section");
const searchResultsNode = document.getElementById("search-results");

const SNAPSHOT_BASE_URL = "https://www.virtualworldsmuseum.com/large-graph/";

const SIZE_DISPLAY_TABLE = {
  bob: { level: 1, radius: 0.55 },
  small: { level: 1, radius: 0.75 },
  medium: { level: 2, radius: 1.05 },
  large: { level: 3, radius: 1.4 },
  custom_large: { level: 4, radius: 1.7 },
  xl: { level: 4, radius: 1.85 },
  xxl: { level: 5, radius: 2.1 }
};

const CATEGORY_COLORS = [
  0x7dd3fc,
  0xa7f3d0,
  0xf9a8d4,
  0xfcd34d,
  0xc4b5fd,
  0xfca5a5,
  0x86efac,
  0xfdba74
];

const CATEGORY_RING_RADIUS = 20;
const WORLD_LINK_COLOR = 0x7c93b7;
const RAIN_LINK_COLOR = 0x8be9fd;
const RAIN_COLUMN_HEIGHT = 42;
const RAIN_COLUMN_TOP_OFFSET = 4.8;
const RAIN_COLUMN_RADIUS = 4.4;
const MIN_RAIN_HIT_RADIUS = 1.15;
const CATEGORY_ICON_SIZE = 5.4;
const ROOT_ICON_SIZE = 7.2;
const ROOT_ICON_Y = 12;
const ROOT_ROTATION_SPEED = 0.0003;
const ROOT_ICON_PATH = "./images/top_icons/virtual_worlds_musuem_icon_sm.png";

const CATEGORY_ICON_PATHS = {
  blockchain: "./images/category_icons/blockchain.png",
  games: "./images/category_icons/games.png",
  "open source": "./images/category_icons/open_source.png",
  specialized: "./images/category_icons/specialized.png",
  "vr & app": "./images/category_icons/vr_and_apps.png",
  webxr: "./images/category_icons/web.png"
};

function getCanonicalNodeId(nodeData) {
  if (!nodeData) {
    return null;
  }

  return nodeData.original_node_id || nodeData.parent_id || nodeData.id;
}

function getSizeRank(sizeValue) {
  if (typeof sizeValue !== "string" || sizeValue.trim() === "") {
    return 0;
  }

  const normalizedSize = sizeValue.trim().toLowerCase();
  return SIZE_DISPLAY_TABLE[normalizedSize]?.level || 0;
}

function getNodeRadius(nodeData, isLocation = false) {
  const normalizedSize = typeof nodeData?.size === "string" ? nodeData.size.trim().toLowerCase() : "";
  const baseRadius = SIZE_DISPLAY_TABLE[normalizedSize]?.radius || 0.65;
  return isLocation ? Math.max(baseRadius * 1.45, 1.8) : Math.max(baseRadius * 0.78, 0.42);
}

function getCategoryIconPath(categoryName) {
  const normalizedCategory = String(categoryName || "").trim().toLowerCase();
  return CATEGORY_ICON_PATHS[normalizedCategory] || "./images/category_icons/all_categories.png";
}

function buildSizeIndicator(sizeValue) {
  const sizeRank = getSizeRank(sizeValue);
  if (!sizeRank) {
    return null;
  }

  const indicator = createNode("span", {
    className: "size-indicator",
    attributes: {
      "aria-label": `${sizeValue} size`,
      title: `${sizeValue} size`
    }
  });

  for (let index = 0; index < sizeRank; index += 1) {
    indicator.appendChild(createNode("span", {
      className: "size-person",
      attributes: { "aria-hidden": "true" }
    }));
  }

  return indicator;
}

function buildGraph(data) {
  const nodesById = new Map();
  const edgesByNode = new Map();
  const edgesBySource = new Map();

  (data.nodes || []).forEach((node) => {
    nodesById.set(node.id, node);
  });

  (data.links || []).forEach((link) => {
    if (!edgesBySource.has(link.source)) {
      edgesBySource.set(link.source, []);
    }
    edgesBySource.get(link.source).push(link.target);

    if (!edgesByNode.has(link.source)) {
      edgesByNode.set(link.source, []);
    }
    if (!edgesByNode.has(link.target)) {
      edgesByNode.set(link.target, []);
    }

    edgesByNode.get(link.source).push(link.target);
    edgesByNode.get(link.target).push(link.source);
  });

  return { nodesById, edgesByNode, edgesBySource };
}

function getDisplayChildren(nodeId, graph) {
  const children = graph.edgesByNode.get(nodeId) || [];
  const visibleChildren = [];
  const seenCanonicalIds = new Set();
  const currentCanonicalId = getCanonicalNodeId(graph.nodesById.get(nodeId)) || nodeId;

  children.forEach((childId) => {
    const childNode = graph.nodesById.get(childId);
    const canonicalId = getCanonicalNodeId(childNode) || childId;

    if (canonicalId === currentCanonicalId) {
      return;
    }

    if (seenCanonicalIds.has(canonicalId)) {
      return;
    }

    seenCanonicalIds.add(canonicalId);
    visibleChildren.push(childId);
  });

  visibleChildren.sort((a, b) => {
    const nodeA = graph.nodesById.get(a);
    const nodeB = graph.nodesById.get(b);
    const sizeRankA = getSizeRank(nodeA?.size);
    const sizeRankB = getSizeRank(nodeB?.size);

    if (sizeRankA !== sizeRankB) {
      return sizeRankB - sizeRankA;
    }

    const nameA = nodeA?.name || nodeA?.id || a;
    const nameB = nodeB?.name || nodeB?.id || b;
    return nameA.localeCompare(nameB);
  });

  return visibleChildren;
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => {
    const sizeRankDelta = getSizeRank(b?.size) - getSizeRank(a?.size);
    if (sizeRankDelta !== 0) {
      return sizeRankDelta;
    }

    return (a?.name || a?.id || "").localeCompare(b?.name || b?.id || "");
  });
}

function buildSceneLayout(graph) {
  const categoryColors = new Map();
  const rootNode = graph.nodesById.get("0") || {
    id: "0",
    name: "Virtual Worlds Museum",
    category: "Virtual Worlds Museum"
  };
  const rootChildren = graph.edgesBySource.get("0") || [];
  const categoryExhibits = rootChildren
    .map((categoryId, index) => {
      const node = graph.nodesById.get(categoryId);
      if (!node) {
        return null;
      }

      const category = node.category || "Uncategorized";
      if (!categoryColors.has(category)) {
        categoryColors.set(category, CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
      }

      const rainNodes = sortNodes(
        (graph.edgesBySource.get(node.id) || [])
          .map((childId) => graph.nodesById.get(childId))
          .filter((childNode) => childNode && childNode.id !== node.id && childNode.id !== "0" && !childNode.duplicate)
      );

      return {
        node,
        category,
        color: categoryColors.get(category),
        rainNodes
      };
    })
    .filter(Boolean);

  categoryExhibits.forEach((entry, index, items) => {
    const angle = -Math.PI / 2 + (index / Math.max(items.length, 1)) * Math.PI * 2;
    entry.angle = angle;
    entry.position = new THREE.Vector3(
      Math.cos(angle) * CATEGORY_RING_RADIUS,
      6,
      Math.sin(angle) * CATEGORY_RING_RADIUS
    );
  });

  const rainCount = categoryExhibits.reduce((sum, entry) => sum + entry.rainNodes.length, 0);
  return { rootNode, exhibits: categoryExhibits, rainCount };
}

function makeLine(points, color, opacity) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity
  });
  return new THREE.Line(geometry, material);
}

function updateLine(line, points) {
  line.geometry.setFromPoints(points);
  line.geometry.computeBoundingSphere();
}

function drawFittedText(context, text, x, y, maxWidth) {
  const value = String(text || "");
  if (context.measureText(value).width <= maxWidth) {
    context.fillText(value, x, y);
    return;
  }

  let clipped = value;
  while (clipped.length > 3 && context.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  context.fillText(`${clipped}...`, x, y);
}

function createLabelSprite(title, subtitle, scale = new THREE.Vector3(13, 3.2, 1)) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 640;
  labelCanvas.height = 160;
  const labelContext = labelCanvas.getContext("2d");
  labelContext.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  labelContext.font = "600 38px system-ui";
  labelContext.fillStyle = "#eef6ff";
  drawFittedText(labelContext, title, 22, 62, 596);
  labelContext.font = "27px system-ui";
  labelContext.fillStyle = "#9fb0c8";
  drawFittedText(labelContext, subtitle, 22, 106, 596);

  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.needsUpdate = true;
  const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false });
  const labelSprite = new THREE.Sprite(labelMaterial);
  labelSprite.scale.copy(scale);
  return labelSprite;
}

function setTooltip(nodeData, position) {
  if (!nodeData) {
    tooltipNode.classList.remove("visible");
    tooltipNode.setAttribute("aria-hidden", "true");
    return;
  }

  tooltipTitleNode.textContent = nodeData.name || nodeData.id || "Untitled";
  clearNode(tooltipCopyNode);
  if (nodeData.start_year) {
    tooltipCopyNode.appendChild(createNode("span", {
      className: "preview-meta",
      text: String(nodeData.start_year)
    }));
  }
  const tooltipSizeIndicator = buildSizeIndicator(nodeData.size);
  if (tooltipSizeIndicator) {
    if (tooltipCopyNode.childNodes.length) {
      tooltipCopyNode.appendChild(document.createTextNode(" "));
    }
    tooltipCopyNode.appendChild(tooltipSizeIndicator);
  }
  if (tooltipCopyNode.childNodes.length) {
    tooltipCopyNode.appendChild(document.createTextNode(" "));
  }
  tooltipCopyNode.appendChild(createNode("span", {
    className: "preview-meta",
    text: nodeData.category || "World"
  }));
  if (nodeData.hub_link) {
    tooltipCopyNode.appendChild(document.createTextNode(" "));
    tooltipCopyNode.appendChild(createNode("span", {
      className: "preview-museum",
      text: "Museum location"
    }));
  }
  tooltipNode.style.left = `${position.x}px`;
  tooltipNode.style.top = `${position.y}px`;
  tooltipNode.classList.add("visible");
  tooltipNode.setAttribute("aria-hidden", "false");
}

function getNodeSummary(nodeData) {
  if (!nodeData) {
    return "Hover a node to inspect it.";
  }

  const details = [nodeData.name || nodeData.id, nodeData.category || "World"];
  if (nodeData.start_year) {
    details.push(`since ${nodeData.start_year}`);
  }
  if (nodeData.hub_link) {
    details.push("museum location");
  }

  return details.join(" • ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createNode(tag, options = {}, children = []) {
  const node = document.createElement(tag);

  if (options.className) {
    node.className = options.className;
  }

  if (options.text !== undefined) {
    node.textContent = options.text;
  }

  if (options.open) {
    node.open = true;
  }

  if (options.href) {
    node.href = options.href;
  }

  if (options.target) {
    node.target = options.target;
  }

  if (options.rel) {
    node.rel = options.rel;
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
  }

  children.forEach((child) => {
    if (child !== null && child !== undefined) {
      node.appendChild(child);
    }
  });

  return node;
}

function normalizeSearchInput(value) {
  return String(value || "").trim().toLowerCase();
}

function isNodeMatch(nodeData, query) {
  if (!query || !nodeData) {
    return false;
  }

  return normalizeSearchInput(nodeData.name).includes(query);
}

function getMatchingNodes(graph, query) {
  const normalizedQuery = normalizeSearchInput(query);
  if (!normalizedQuery || !graph) {
    return [];
  }

  return [...graph.nodesById.values()].filter((node) => {
    if (!node || node.id === "0" || node.duplicate) {
      return false;
    }

    return isNodeMatch(node, normalizedQuery);
  });
}

function renderSearchResults(matches, query) {
  clearNode(searchResultsNode);

  if (!query || !query.trim()) {
    searchResultsSectionNode.hidden = true;
    return;
  }

  searchResultsSectionNode.hidden = false;
  previewDetailsSectionNode.hidden = true;
  previewLocationsSectionNode.hidden = true;
  previewConnectedSectionNode.hidden = true;

  const header = createNode("div", { className: "search-results-header" }, [
    createNode("span", { className: "preview-meta", text: `${matches.length} matching worlds` })
  ]);
  searchResultsNode.appendChild(header);

  if (!matches.length) {
    searchResultsNode.appendChild(createNode("p", { className: "value-empty", text: "No matching worlds found." }));
    return;
  }

  const list = createNode("div", { className: "search-results-grid" });
  matches.forEach((nodeData) => {
    const item = createNode("button", {
      className: "search-result-card",
      text: nodeData.name || nodeData.id,
      attributes: {
        type: "button"
      }
    });

    item.appendChild(createNode("span", {
      className: "preview-meta",
      text: nodeData.category || "World"
    }));

    item.addEventListener("click", () => {
      window.__ringSelectNode?.(nodeData.id);
      sceneSearchInput?.focus();
    });

    list.appendChild(item);
  });

  searchResultsNode.appendChild(list);
}

function updateSearchHighlights(query) {
  const normalizedQuery = normalizeSearchInput(query);
  const hasQuery = Boolean(normalizedQuery);

  interactiveMeshes.forEach((mesh) => {
    const nodeData = mesh.userData?.nodeData;
    if (!nodeData) {
      return;
    }

    const matches = hasQuery && normalizeSearchInput(nodeData.name).includes(normalizedQuery);
    mesh.userData.isSearchMatch = matches;

    if (matches) {
      if (mesh.material.color) {
        mesh.material.color.setHex(0xffd74f);
      }
      if (mesh.material.emissive) {
        mesh.material.emissive.setHex(0xffd74f);
      }
    } else {
      if (mesh.userData.originalColor && mesh.material.color) {
        mesh.material.color.copy(mesh.userData.originalColor);
      }
      if (mesh.userData.originalEmissive && mesh.material.emissive) {
        mesh.material.emissive.copy(mesh.userData.originalEmissive);
      }
    }
  });
}

function appendLinkedText(container, text) {
  const urlPattern = /https?:\/\/[^\s)]+/g;
  let lastIndex = 0;
  let found = false;
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    found = true;

    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    container.appendChild(createNode("a", {
      href: match[0],
      target: "_blank",
      rel: "noreferrer noopener",
      text: match[0]
    }));

    lastIndex = match.index + match[0].length;
  }

  if (!found) {
    container.textContent = text;
    return;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function buildSnapshotUrls(nodeData) {
  if (typeof nodeData?.snapshotx200 !== "string" || nodeData.snapshotx200.trim() === "") {
    return null;
  }

  return {
    preview: new URL(nodeData.snapshotx200, SNAPSHOT_BASE_URL).toString(),
    full: new URL(nodeData.snapshot || nodeData.snapshotx200, SNAPSHOT_BASE_URL).toString()
  };
}

function buildPreviewDetails(nodeData) {
  const excludedKeys = new Set(["id", "name", "snapshotx200", "snapshot", "category", "size"]);
  const entries = [];

  if (typeof nodeData.description === "string" && nodeData.description.trim() !== "") {
    entries.push(["Description", nodeData.description.trim()]);
    excludedKeys.add("description");
  }

  Object.entries(nodeData).forEach(([key, value]) => {
    if (excludedKeys.has(key) || value === null || value === "") {
      return;
    }

    entries.push([key, value]);
  });

  return entries;
}

function buildConnectedTree(nodeId, graph, depth = 0, path = new Set(), expandChildren = true) {
  const nodeData = graph.nodesById.get(nodeId);
  if (!nodeData) {
    return null;
  }

  const details = createNode("details", { open: depth === 0 });
  const summaryChildren = [
    createNode("button", {
      className: "preview-tree-select",
      text: nodeData.name || nodeData.id,
      attributes: {
        type: "button"
      }
    })
  ];

  if (nodeData.start_year) {
    summaryChildren.push(createNode("span", { className: "preview-tree-meta", text: String(nodeData.start_year) }));
  }
  const treeSizeIndicator = buildSizeIndicator(nodeData.size);
  if (treeSizeIndicator) {
    summaryChildren.push(treeSizeIndicator);
  }
  summaryChildren.push(createNode("span", { className: "preview-tree-meta", text: nodeData.category || "World" }));
  if (typeof nodeData.hub_link === "string" && nodeData.hub_link.trim() !== "") {
    summaryChildren.push(createNode("span", {
      className: "preview-museum",
      text: "Museum location"
    }));
  }

  const hasLinks = Boolean(
    (typeof nodeData.hub_link === "string" && nodeData.hub_link.trim() !== "") ||
    (typeof nodeData.link === "string" && nodeData.link.trim() !== "")
  );
  const children = expandChildren ? getDisplayChildren(nodeId, graph) : [];
  if (!children.length) {
    details.classList.add("preview-tree-leaf");
  }
  if (!hasLinks && children.length) {
    summaryChildren.push(createNode("span", {
      className: "preview-tree-meta",
      text: `${children.length} connections`
    }));
  }

  details.appendChild(createNode("summary", {}, summaryChildren));
  details.querySelector(".preview-tree-select")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.__ringSelectNode?.(nodeId);
  });
  if (!children.length) {
    details.querySelector("summary")?.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest(".preview-tree-select")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      window.__ringSelectNode?.(nodeId);
    });
  }
  if (!children.length) {
    return details;
  }

  const nextPath = new Set(path);
  nextPath.add(nodeId);
  nextPath.add(getCanonicalNodeId(nodeData) || nodeId);
  const body = createNode("div", { className: "preview-tree-body" });

  children.forEach((childId) => {
    const childNode = graph.nodesById.get(childId);
    const canonicalId = getCanonicalNodeId(childNode) || childId;

    if (nextPath.has(childId) || nextPath.has(canonicalId)) {
      return;
    }

    const childTree = buildConnectedTree(childId, graph, depth + 1, nextPath, true);
    if (childTree) {
      body.appendChild(childTree);
    }
  });

  if (body.children.length) {
    details.appendChild(body);
  }

  return details;
}

function buildLocationTree(nodeData) {
  const details = createNode("details");
  const summaryChildren = [
    createNode("button", {
      className: "preview-tree-select",
      text: nodeData.name || nodeData.id,
      attributes: {
        type: "button"
      }
    })
  ];

  if (nodeData.start_year) {
    summaryChildren.push(createNode("span", { className: "preview-tree-meta", text: String(nodeData.start_year) }));
  }
  const sizeIndicator = buildSizeIndicator(nodeData.size);
  if (sizeIndicator) {
    summaryChildren.push(sizeIndicator);
  }
  summaryChildren.push(createNode("span", { className: "preview-tree-meta", text: nodeData.category || "Location" }));

  details.appendChild(createNode("summary", {}, summaryChildren));
  details.querySelector(".preview-tree-select")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.__ringSelectNode?.(nodeData.id);
  });
  details.querySelector("summary")?.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest(".preview-tree-select")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    window.__ringSelectNode?.(nodeData.id);
  });

  const body = createNode("div", { className: "preview-tree-body" });
  if (typeof nodeData.hub_link === "string" && nodeData.hub_link.trim() !== "") {
    body.appendChild(createNode("a", {
      className: "preview-button museum-link",
      href: nodeData.hub_link,
      target: "_blank",
      rel: "noreferrer noopener",
      text: "Museum Location"
    }));
  }
  if (typeof nodeData.link === "string" && nodeData.link.trim() !== "") {
    body.appendChild(createNode("a", {
      className: "preview-button world-link",
      href: nodeData.link,
      target: "_blank",
      rel: "noreferrer noopener",
      text: "World Link"
    }));
  }
  if (body.children.length) {
    details.appendChild(body);
  }

  return details;
}

function buildMuseumLocationsList(graph) {
  const locationMap = new Map();

  [...graph.nodesById.values()].forEach((node) => {
    if (node.id === "0" || typeof node.hub_link !== "string" || node.hub_link.trim() === "") {
      return;
    }

    const normalizedHubLink = node.hub_link.trim();
    if (!locationMap.has(normalizedHubLink)) {
      locationMap.set(normalizedHubLink, node);
    }
  });

  return [...locationMap.values()].sort((a, b) => {
    const sizeRankDelta = getSizeRank(b?.size) - getSizeRank(a?.size);
    if (sizeRankDelta !== 0) {
      return sizeRankDelta;
    }

    return (a.name || a.id).localeCompare(b.name || b.id);
  });
}

function buildMajorCategoriesList(graph) {
  if (Array.isArray(window.__ringMajorExhibits)) {
    return window.__ringMajorExhibits.map((entry) => entry.node);
  }

  return buildSceneLayout(graph).exhibits.map((entry) => entry.node);
}

function buildCategoryConnectedList(categoryName, graph) {
  return sortNodes(
    [...graph.nodesById.values()].filter((candidate) => {
      if (!candidate || candidate.id === "0" || candidate.duplicate) {
        return false;
      }

      return candidate.category === categoryName;
    })
  );
}

function updatePreview(nodeData) {
  const graph = window.__ringGraph;

  if (!nodeData) {
    previewTitleNode.textContent = "No selection";
    previewCopyNode.textContent = "Hover a node for a quick look, then click to pin it here.";
    previewMuseumLinkNode.hidden = true;
    previewMuseumLinkNode.removeAttribute("href");
    previewWorldLinkNode.hidden = true;
    previewWorldLinkNode.removeAttribute("href");
    previewSnapshotNode.hidden = true;
    previewSnapshotNode.removeAttribute("href");
    previewSnapshotImageNode.removeAttribute("src");
    previewSnapshotImageNode.alt = "";
    previewDetailsSectionNode.hidden = true;
    clearNode(previewDetailsNode);
    previewLocationsSectionNode.hidden = true;
    clearNode(previewLocationsNode);
    previewConnectedSectionNode.hidden = true;
    clearNode(previewConnectedNode);
    return;
  }

  previewTitleNode.textContent = nodeData.name || nodeData.id || "Untitled";
  clearNode(previewCopyNode);
  if (nodeData.start_year) {
    previewCopyNode.appendChild(createNode("span", {
      className: "preview-meta",
      text: String(nodeData.start_year)
    }));
  }
  const previewSizeIndicator = buildSizeIndicator(nodeData.size);
  if (previewSizeIndicator) {
    if (previewCopyNode.childNodes.length) {
      previewCopyNode.appendChild(document.createTextNode(" "));
    }
    previewCopyNode.appendChild(previewSizeIndicator);
  }
  if (nodeData.category || previewCopyNode.childNodes.length === 0) {
    if (previewCopyNode.childNodes.length) {
      previewCopyNode.appendChild(document.createTextNode(" "));
    }
    previewCopyNode.appendChild(createNode("span", {
      className: "preview-meta",
      text: nodeData.category || "World"
    }));
  }
  if (typeof nodeData.hub_link === "string" && nodeData.hub_link.trim() !== "") {
    previewMuseumLinkNode.href = nodeData.hub_link;
    previewMuseumLinkNode.hidden = false;
  } else {
    previewMuseumLinkNode.hidden = true;
    previewMuseumLinkNode.removeAttribute("href");
  }

  if (typeof nodeData.link === "string" && nodeData.link.trim() !== "") {
    previewWorldLinkNode.href = nodeData.link;
    previewWorldLinkNode.hidden = false;
  } else {
    previewWorldLinkNode.hidden = true;
    previewWorldLinkNode.removeAttribute("href");
  }

  const snapshotUrls = buildSnapshotUrls(nodeData);
  if (snapshotUrls) {
    previewSnapshotNode.href = snapshotUrls.full;
    previewSnapshotImageNode.src = snapshotUrls.preview;
    previewSnapshotImageNode.alt = `${nodeData.name || nodeData.id} snapshot`;
    previewSnapshotNode.hidden = false;
  } else {
    previewSnapshotNode.hidden = true;
    previewSnapshotNode.removeAttribute("href");
    previewSnapshotImageNode.removeAttribute("src");
    previewSnapshotImageNode.alt = "";
  }

  clearNode(previewDetailsNode);
  const detailEntries = buildPreviewDetails(nodeData);
  if (detailEntries.length) {
    detailEntries.forEach(([key, value]) => {
      const valueNode = createNode("div", { className: "preview-detail-value" });

      if (typeof value === "string") {
        appendLinkedText(valueNode, value);
      } else {
        valueNode.textContent = String(value);
      }

      previewDetailsNode.appendChild(createNode("div", { className: "preview-detail" }, [
        createNode("div", { className: "preview-detail-key", text: key }),
        valueNode
      ]));
    });
    previewDetailsSectionNode.hidden = false;
  } else {
    previewDetailsSectionNode.hidden = true;
  }

  clearNode(previewLocationsNode);
  if (graph && nodeData.id === "0") {
    const majorCategories = buildMajorCategoriesList(graph);
    majorCategories.forEach((categoryNode) => {
      previewLocationsNode.appendChild(buildLocationTree(categoryNode));
    });
    previewLocationsSectionNode.hidden = majorCategories.length === 0;
  } else {
    previewLocationsSectionNode.hidden = true;
  }

  clearNode(previewConnectedNode);
  if (graph && typeof nodeData.id === "string" && nodeData.id.startsWith("category:")) {
    const connectedNodes = buildCategoryConnectedList(nodeData.category, graph);
    connectedNodes.forEach((connectedNode) => {
      const connectedTree = buildConnectedTree(connectedNode.id, graph, 0, new Set(), false);
      if (connectedTree) {
        previewConnectedNode.appendChild(connectedTree);
      }
    });
    previewConnectedSectionNode.hidden = connectedNodes.length === 0;
  } else if (graph && graph.nodesById.has(nodeData.id)) {
    const connectedTree = buildConnectedTree(nodeData.id, graph, 0, new Set());
    if (connectedTree) {
      previewConnectedNode.appendChild(connectedTree);
      previewConnectedSectionNode.hidden = false;
    } else {
      previewConnectedSectionNode.hidden = true;
    }
  } else {
    previewConnectedSectionNode.hidden = true;
  }
}

function scrollPreviewToTop() {
  if (!hudNode) {
    return;
  }

  hudNode.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function attachOrbitControls(camera, host) {
  const target = new THREE.Vector3(0, 0, 0);
  const spherical = new THREE.Spherical(47, 1.08, 0.18);
  let dragging = false;
  const pointer = { x: 0, y: 0 };

  function updateCamera() {
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.18, Math.PI - 0.18);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, 35, 180);
    camera.position.setFromSpherical(spherical).add(target);
    camera.lookAt(target);
  }

  host.addEventListener("pointerdown", (event) => {
    dragging = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    host.setPointerCapture(event.pointerId);
  });

  host.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }

    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    spherical.theta -= deltaX * 0.008;
    spherical.phi += deltaY * 0.008;
    updateCamera();
  });

  host.addEventListener("pointerup", (event) => {
    dragging = false;
    host.releasePointerCapture(event.pointerId);
  });

  host.addEventListener("wheel", (event) => {
    event.preventDefault();
    spherical.radius += event.deltaY * 0.04;
    updateCamera();
  }, { passive: false });

  updateCamera();
  return { target, updateCamera, spherical };
}

async function loadGraph() {
  const response = await fetch("./vwm.json");
  if (!response.ok) {
    throw new Error(`Failed to load vwm.json: ${response.status}`);
  }

  return response.json();
}

async function init() {
  const graph = buildGraph(await loadGraph());
  window.__ringGraph = graph;
  const { rootNode, exhibits, rainCount } = buildSceneLayout(graph);
  window.__ringMajorExhibits = exhibits;

  statusNode.textContent = ``; //`Loaded ${exhibits.length} major categories with ${rainCount} falling connected nodes`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040914);
  scene.fog = new THREE.FogExp2(0x040914, 0.008);

  const getSceneSize = () => {
    const width = Math.max(sceneHost.clientWidth || window.innerWidth, 1);
    const height = Math.max(sceneHost.clientHeight || window.innerHeight, 1);
    return { width, height };
  };

  const initialSceneSize = getSceneSize();
  const camera = new THREE.PerspectiveCamera(52, initialSceneSize.width / initialSceneSize.height, 0.1, 600);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialSceneSize.width, initialSceneSize.height);
  sceneHost.appendChild(renderer.domElement);

  const controls = attachOrbitControls(camera, renderer.domElement);

  scene.add(new THREE.AmbientLight(0xaecfff, 1.9));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
  keyLight.position.set(14, 28, 16);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.1);
  rimLight.position.set(-18, -14, -20);
  scene.add(rimLight);

  const rootGroup = new THREE.Group();
  const interactiveMeshes = [];
  const nodeMeshById = new Map();
  const iconTextureLoader = new THREE.TextureLoader();
  scene.add(rootGroup);

  function registerInteractiveMesh(mesh) {
    interactiveMeshes.push(mesh);

    if (!mesh.userData) {
      mesh.userData = {};
    }

    if (mesh.material) {
      if (mesh.material.color && !mesh.userData.originalColor) {
        mesh.userData.originalColor = mesh.material.color.clone();
      }
      if (mesh.material.emissive && !mesh.userData.originalEmissive) {
        mesh.userData.originalEmissive = mesh.material.emissive.clone();
      }
    }

    const nodeId = mesh.userData?.nodeData?.id;
    if (nodeId && !nodeMeshById.has(nodeId)) {
      nodeMeshById.set(nodeId, mesh);
    }
  }

  const grid = new THREE.GridHelper(120, 12, 0x17314a, 0x0d1a2a);
  grid.position.y = -RAIN_COLUMN_HEIGHT + 1;
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  scene.add(grid);

  const rootRadius = ROOT_ICON_SIZE * 0.5;
  const rootTexture = iconTextureLoader.load(ROOT_ICON_PATH);
  rootTexture.colorSpace = THREE.SRGBColorSpace;
  const rootMesh = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: rootTexture,
      color: 0xffffff,
      transparent: true,
      depthWrite: false
    })
  );
  const rootPosition = new THREE.Vector3(0, ROOT_ICON_Y, 0);
  rootMesh.position.copy(rootPosition);
  rootMesh.scale.set(ROOT_ICON_SIZE, ROOT_ICON_SIZE, 1);
  rootMesh.userData = {
    nodeData: rootNode,
    baseScale: ROOT_ICON_SIZE,
    basePosition: rootPosition.clone(),
    hitRadius: ROOT_ICON_SIZE * 0.74,
    motion: "float",
    link: rootNode.link || null
  };
  rootGroup.add(rootMesh);
  registerInteractiveMesh(rootMesh);

  const categoryRingPoints = [];
  for (let index = 0; index <= 128; index += 1) {
    const angle = (index / 128) * Math.PI * 2;
    categoryRingPoints.push(new THREE.Vector3(
      Math.cos(angle) * CATEGORY_RING_RADIUS,
      6,
      Math.sin(angle) * CATEGORY_RING_RADIUS
    ));
  }
  rootGroup.add(makeLine(categoryRingPoints, 0xa7f3d0, 0.14));

  exhibits.forEach((exhibit, exhibitIndex) => {
    const worldRadius = CATEGORY_ICON_SIZE * 0.5;
    const iconTexture = iconTextureLoader.load(getCategoryIconPath(exhibit.category));
    iconTexture.colorSpace = THREE.SRGBColorSpace;
    const worldMesh = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: iconTexture,
        color: 0xffffff,
        transparent: true,
        depthWrite: false
      })
    );
    worldMesh.position.copy(exhibit.position);
    worldMesh.scale.set(CATEGORY_ICON_SIZE, CATEGORY_ICON_SIZE, 1);
    worldMesh.userData = {
      nodeData: exhibit.node,
      baseScale: CATEGORY_ICON_SIZE,
      basePosition: exhibit.position.clone(),
      hitRadius: CATEGORY_ICON_SIZE * 0.78,
      motion: "float",
      link: exhibit.node.link || null
    };
    rootGroup.add(worldMesh);
    registerInteractiveMesh(worldMesh);

    rootGroup.add(makeLine([rootPosition.clone(), exhibit.position.clone()], WORLD_LINK_COLOR, 0.34));

    const labelSprite = createLabelSprite(
      exhibit.node.name || exhibit.node.id,
      `${exhibit.rainNodes.length} connected nodes`,
      new THREE.Vector3(11.5, 2.9, 1)
    );
    labelSprite.position.copy(exhibit.position.clone().add(new THREE.Vector3(0, worldRadius + 2.4, 0)));
    rootGroup.add(labelSprite);

    const rainTop = exhibit.position.y - RAIN_COLUMN_TOP_OFFSET;
    const rainBottom = rainTop - RAIN_COLUMN_HEIGHT;
    rootGroup.add(makeLine([
      exhibit.position.clone().add(new THREE.Vector3(0, -worldRadius * 0.7, 0)),
      new THREE.Vector3(exhibit.position.x, rainBottom, exhibit.position.z)
    ], RAIN_LINK_COLOR, 0.16));

    exhibit.rainNodes.forEach((rainNode, rainIndex) => {
      const rainAngle = rainIndex * 2.399963229728653 + exhibitIndex * 0.37;
      const rainRadius = Math.sqrt((rainIndex + 0.5) / Math.max(exhibit.rainNodes.length, 1)) * RAIN_COLUMN_RADIUS;
      const offset = new THREE.Vector3(
        Math.cos(rainAngle) * rainRadius,
        0,
        Math.sin(rainAngle) * rainRadius
      );
      const dropRadius = Math.min(Math.max(getNodeRadius(rainNode, false) * 0.46, 0.2), 0.56);
      const rainMesh = new THREE.Mesh(
        new THREE.SphereGeometry(dropRadius, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0xdff8ff,
          emissive: exhibit.color,
          emissiveIntensity: 0.28,
          roughness: 0.48,
          metalness: 0.02,
          transparent: true,
          opacity: 0.86
        })
      );
      const basePosition = exhibit.position.clone().add(offset);
      basePosition.y = rainTop - ((rainIndex / Math.max(exhibit.rainNodes.length, 1)) * RAIN_COLUMN_HEIGHT);
      rainMesh.position.copy(basePosition);
      rainMesh.userData = {
        nodeData: rainNode,
        baseScale: 1,
        basePosition,
        hitRadius: Math.max(dropRadius * 2.8, MIN_RAIN_HIT_RADIUS),
        motion: "rain",
        rain: {
          anchor: exhibit.position.clone(),
          offset,
          topY: rainTop,
          height: RAIN_COLUMN_HEIGHT,
          speed: 1.9 + (rainIndex % 7) * 0.22,
          phase: (rainIndex * 5.7 + exhibitIndex * 3.1) % RAIN_COLUMN_HEIGHT,
          sway: 0.7 + (rainIndex % 5) * 0.13
        },
        link: rainNode.link || rainNode.hub_link || exhibit.node.link || null
      };
      rootGroup.add(rainMesh);
      registerInteractiveMesh(rainMesh);
    });
  });

  const raycaster = new THREE.Raycaster();
  const hitSphere = new THREE.Sphere();
  const hitPoint = new THREE.Vector3();
  const hitCenter = new THREE.Vector3();
  const pointer = new THREE.Vector2(2, 2);
  const tapState = {
    startX: 0,
    startY: 0,
    startTime: 0
  };
  let hoveredMesh = null;
  let selectedMesh = null;
  let selectedNodeData = graph.nodesById.get("0") || null;
  let lastFrameTime = performance.now();
  let rainElapsedTime = lastFrameTime * 0.001;

  function getHitMeshAtClientPosition(clientX, clientY) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    let closestMesh = null;
    let closestDistance = Infinity;

    interactiveMeshes.forEach((mesh) => {
      mesh.getWorldPosition(hitCenter);
      hitSphere.center.copy(hitCenter);
      hitSphere.radius = mesh.userData.hitRadius || 1;

      if (!raycaster.ray.intersectSphere(hitSphere, hitPoint)) {
        return;
      }

      const distance = raycaster.ray.origin.distanceTo(hitPoint);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestMesh = mesh;
      }
    });

    return closestMesh;
  }

  function setHoveredMesh(mesh, clientX = 0, clientY = 0) {
    if (hoveredMesh && hoveredMesh !== mesh) {
      hoveredMesh.scale.setScalar(hoveredMesh.userData.baseScale);
      if (hoveredMesh === selectedMesh) {
        hoveredMesh.scale.setScalar(hoveredMesh.userData.baseScale * 1.2);
      }
    }

    hoveredMesh = mesh;

    if (!mesh) {
      updatePreview(selectedMesh?.userData?.nodeData || selectedNodeData || null);
      setTooltip(null);
      return;
    }

    mesh.scale.setScalar(mesh.userData.baseScale * 1.14);
    updatePreview(mesh.userData.nodeData);
    setTooltip(mesh.userData.nodeData, { x: clientX, y: clientY });
  }

  function setSelectedMesh(mesh) {
    if (selectedMesh && selectedMesh !== hoveredMesh) {
      selectedMesh.scale.setScalar(selectedMesh.userData.baseScale);
    }

    selectedMesh = mesh;

    if (!selectedMesh) {
      updatePreview(hoveredMesh?.userData?.nodeData || selectedNodeData || null);
      return;
    }

    selectedNodeData = selectedMesh.userData.nodeData;

    if (selectedMesh !== hoveredMesh) {
      selectedMesh.scale.setScalar(selectedMesh.userData.baseScale * 1.2);
    }

    updatePreview(selectedMesh.userData.nodeData);
    scrollPreviewToTop();
  }

  window.__ringSelectNode = (nodeId) => {
    if (nodeId === "0") {
      selectedMesh = null;
      selectedNodeData = graph.nodesById.get("0") || null;
      updatePreview(selectedNodeData);
      scrollPreviewToTop();
      return;
    }

    const targetMesh = nodeMeshById.get(nodeId);
    if (!targetMesh) {
      return;
    }

    setSelectedMesh(targetMesh);
  };

  renderer.domElement.addEventListener("pointermove", (event) => {
    const hitMesh = getHitMeshAtClientPosition(event.clientX, event.clientY);
    setHoveredMesh(hitMesh, event.clientX, event.clientY);
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    setHoveredMesh(null);
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    tapState.startX = event.clientX;
    tapState.startY = event.clientY;
    tapState.startTime = performance.now();
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    const deltaX = event.clientX - tapState.startX;
    const deltaY = event.clientY - tapState.startY;
    const movedDistance = Math.hypot(deltaX, deltaY);
    const elapsed = performance.now() - tapState.startTime;

    if (movedDistance > 12 || elapsed > 450) {
      return;
    }

    const hitMesh = getHitMeshAtClientPosition(event.clientX, event.clientY);
    if (hitMesh) {
      setHoveredMesh(hitMesh, event.clientX, event.clientY);
      setSelectedMesh(hitMesh);
    }
  });

  renderer.domElement.addEventListener("click", () => {
    setSelectedMesh(hoveredMesh);
  });

  if (sceneSearchInput && sceneSearchForm && searchResultsNode && searchResultsSectionNode) {
    sceneSearchInput.addEventListener("input", () => {
      const query = sceneSearchInput.value;
      updateSearchHighlights(query);
      if (!query.trim()) {
        renderSearchResults([], "");
      }
    });

    sceneSearchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = sceneSearchInput.value.trim();
      const matches = getMatchingNodes(graph, query);
      renderSearchResults(matches, query);
    });
  }

  window.addEventListener("resize", () => {
    const sceneSize = getSceneSize();
    camera.aspect = sceneSize.width / sceneSize.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneSize.width, sceneSize.height);
  });

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaTime = Math.min((now - lastFrameTime) * 0.001, 0.08);
    lastFrameTime = now;
    rainElapsedTime += deltaTime * (hoveredMesh ? 0.25 : 1);
    rootGroup.rotation.y += ROOT_ROTATION_SPEED;

    interactiveMeshes.forEach((mesh, index) => {
      if (mesh.userData.motion === "rain" && mesh.userData.rain) {
        const rain = mesh.userData.rain;
        const fallDistance = (rainElapsedTime * rain.speed + rain.phase) % rain.height;
        const sway = Math.sin(rainElapsedTime * rain.sway + rain.phase) * 0.22;
        mesh.position.x = rain.anchor.x + rain.offset.x + sway;
        mesh.position.y = rain.topY - fallDistance;
        mesh.position.z = rain.anchor.z + rain.offset.z + Math.cos(rainElapsedTime * rain.sway + rain.phase) * 0.18;
        return;
      }

      const offset = index * 0.17;
      const basePosition = mesh.userData.basePosition || new THREE.Vector3(0, 0, 0);
      mesh.position.x = basePosition.x;
      mesh.position.y = basePosition.y + Math.sin(now * 0.001 + offset) * 0.16;
      mesh.position.z = basePosition.z;
    });

    renderer.render(scene, camera);
  }

  updatePreview(selectedNodeData);
  controls.updateCamera();
  animate();
}

init().catch((error) => {
  statusNode.textContent = "Unable to load 3D layout";
  previewTitleNode.textContent = "Unable to load 3D layout";
  previewCopyNode.textContent = error instanceof Error ? error.message : String(error);
  previewMuseumLinkNode.hidden = true;
  previewMuseumLinkNode.removeAttribute("href");
  previewWorldLinkNode.hidden = true;
  previewWorldLinkNode.removeAttribute("href");
});
