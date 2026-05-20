const statusNode = document.getElementById("status");
const treeNode = document.getElementById("tree");
const SNAPSHOT_BASE_URL = "https://www.virtualworldsmuseum.com/large-graph/";
const SIZE_DISPLAY_TABLE = {
  bob: { level: 1, label: "Bob", title: "Bob / very small" },
  small: { level: 1, label: "Small", title: "Small" },
  medium: { level: 2, label: "Medium", title: "Medium" },
  large: { level: 3, label: "Large", title: "Large" },
  custom_large: { level: 4, label: "Custom Large", title: "Custom Large" },
  xl: { level: 4, label: "XL", title: "XL" },
  xxl: { level: 5, label: "XXL", title: "XXL" }
};

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

function wireDetailsToggle(details, summary) {
  summary.setAttribute("role", "button");
  summary.setAttribute("tabindex", "0");

  const toggle = () => {
    details.open = !details.open;
  };

  summary.addEventListener("click", (event) => {
    event.preventDefault();
    toggle();
  });

  summary.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggle();
  });
}

function createMuseumLinkButton(href) {
  const link = createNode("a", {
    className: "summary-link-button",
    href,
    target: "_blank",
    rel: "noreferrer noopener",
    text: "Museum Location"
  });

  link.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  link.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });

  return link;
}

function createWorldLinkButton(href) {
  const link = createNode("a", {
    className: "summary-link-button world-link",
    href,
    target: "_blank",
    rel: "noreferrer noopener",
    text: "World Link"
  });

  link.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  link.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });

  return link;
}

function buildSizeIndicator(sizeValue) {
  if (typeof sizeValue !== "string" || sizeValue.trim() === "") {
    return null;
  }

  const normalizedSize = sizeValue.trim().toLowerCase();
  const sizeInfo = SIZE_DISPLAY_TABLE[normalizedSize];
  if (!sizeInfo) {
    return createNode("span", { className: "meta", text: sizeValue });
  }

  const people = createNode("span", {
    className: "size-indicator",
    attributes: {
      title: sizeInfo.title,
      "aria-label": `${sizeInfo.label} size`
    }
  });

  for (let index = 0; index < sizeInfo.level; index += 1) {
    people.appendChild(createNode("span", { className: "size-person", attributes: { "aria-hidden": "true" } }));
  }

  return people;
}

function getSizeRank(sizeValue) {
  if (typeof sizeValue !== "string" || sizeValue.trim() === "") {
    return 0;
  }

  const normalizedSize = sizeValue.trim().toLowerCase();
  return SIZE_DISPLAY_TABLE[normalizedSize]?.level || 0;
}

function formatValue(value) {
  if (value === null) {
    return { className: "value-null", text: "null" };
  }

  if (typeof value === "string") {
    return { className: "value-string", text: value };
  }

  if (typeof value === "number") {
    return { className: "value-number", text: String(value) };
  }

  if (typeof value === "boolean") {
    return { className: "value-boolean", text: String(value) };
  }

  return { className: "", text: String(value) };
}

function appendLinkedText(container, text) {
  const urlPattern = /https?:\/\/[^\s)]+/g;
  let lastIndex = 0;
  let matched = false;
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    matched = true;

    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    container.appendChild(
      createNode("a", {
        className: "value-link",
        href: match[0],
        target: "_blank",
        rel: "noreferrer noopener",
        text: match[0]
      })
    );

    lastIndex = match.index + match[0].length;
  }

  if (!matched) {
    const formatted = formatValue(text);
    container.appendChild(createNode("span", { className: formatted.className, text: formatted.text }));
    return;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function buildMetadataItem(label, value, forceLinkedText = false) {
  const item = createNode("li", { className: "tree-node" });
  const row = createNode("div", { className: "value-line" }, [
    createNode("code", { className: "meta-key", text: `${label}:` })
  ]);

  if (forceLinkedText && typeof value === "string") {
    appendLinkedText(row, value);
  } else if ((label === "link" || label === "hub_link") && typeof value === "string") {
    row.appendChild(
      createNode("a", {
        className: "value-link",
        href: value,
        target: "_blank",
        rel: "noreferrer noopener",
        text: value
      })
    );
  } else {
    const formatted = formatValue(value);
    row.appendChild(createNode("span", { className: formatted.className, text: formatted.text }));
  }

  item.appendChild(row);
  return item;
}

function buildMetadataList(nodeData, excludedKeys = []) {
  const excluded = new Set(["id", "name", ...excludedKeys]);
  const metadata = Object.entries(nodeData).filter(([key, value]) => {
    return !excluded.has(key) && value !== null && value !== "";
  });

  if (!metadata.length) {
    return createNode("p", { className: "value-empty", text: "No additional metadata." });
  }

  const list = createNode("ul");

  metadata.forEach(([key, value]) => {
    const shouldLinkText = key === "Meta Destination API Name" || key === "Meta DeepLink Message";
    list.appendChild(buildMetadataItem(key, value, shouldLinkText));
  });

  return list;
}

function countMetadataEntries(nodeData, excludedKeys = []) {
  const excluded = new Set(["id", "name", ...excludedKeys]);
  return Object.entries(nodeData).filter(([key, value]) => {
    return !excluded.has(key) && value !== null && value !== "";
  }).length;
}

function buildSnapshotPreview(nodeData) {
  if (typeof nodeData?.snapshotx200 !== "string" || nodeData.snapshotx200.trim() === "") {
    return null;
  }

  const snapshotUrl = new URL(nodeData.snapshotx200, SNAPSHOT_BASE_URL).toString();
  const fullSizeUrl = new URL(nodeData.snapshot || nodeData.snapshotx200, SNAPSHOT_BASE_URL).toString();
  return createNode("a", {
    className: "snapshot-preview",
    href: fullSizeUrl,
    target: "_blank",
    rel: "noreferrer noopener"
  }, [
    createNode("img", {
      className: "snapshot-image",
      attributes: {
        src: snapshotUrl,
        alt: `${nodeData.name || nodeData.id} snapshot`,
        loading: "lazy",
        decoding: "async"
      }
    })
  ]);
}

function buildAboutSnapshot(nodeData) {
  const snapshotPreview = buildSnapshotPreview(nodeData);
  if (!snapshotPreview) {
    return null;
  }

  return createNode("div", { className: "about-snapshot" }, [snapshotPreview]);
}

function getCanonicalNodeId(nodeData) {
  if (!nodeData) {
    return null;
  }

  return nodeData.original_node_id || nodeData.parent_id || nodeData.id;
}

function getDisplayChildren(nodeId, graph, path = new Set()) {
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
    const hasHubLinkA = Boolean(typeof nodeA?.hub_link === "string" && nodeA.hub_link.trim() !== "");
    const hasHubLinkB = Boolean(typeof nodeB?.hub_link === "string" && nodeB.hub_link.trim() !== "");

    if (hasHubLinkA !== hasHubLinkB) {
      return hasHubLinkA ? -1 : 1;
    }

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

function buildConnectedNodesSection(nodeId, graph, depth = 0, path = new Set()) {
  const children = getDisplayChildren(nodeId, graph, path);
  if (!children.length) {
    return null;
  }

  const nextPath = new Set(path);
  nextPath.add(nodeId);
  const list = createNode("ul");
  let visibleCount = 0;

  children.forEach((childId) => {
    const childNode = graph.nodesById.get(childId);
    const canonicalId = getCanonicalNodeId(childNode) || childId;

    if (nextPath.has(childId) || nextPath.has(canonicalId)) {
      return;
    }

    visibleCount += 1;
    list.appendChild(buildGraphTree(childId, graph, depth + 1, nextPath));
  });

  if (!visibleCount) {
    return null;
  }

  const childSection = createNode("div", { className: "child-section" }, [
    createNode("p", { className: "child-heading", text: "Connected worlds" })
  ]);
  childSection.appendChild(list);
  return childSection;
}

function buildLocationsSection(graph) {
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

  const locationNodes = [...locationMap.values()].sort((a, b) => {
    const sizeRankA = getSizeRank(a?.size);
    const sizeRankB = getSizeRank(b?.size);

    if (sizeRankA !== sizeRankB) {
      return sizeRankB - sizeRankA;
    }

    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  const section = createNode("div", { className: "child-section" }, [
    createNode("p", { className: "child-heading", text: "Virtual Worlds Museum Locations" })
  ]);

  if (!locationNodes.length) {
    section.appendChild(createNode("p", { className: "value-empty", text: "No hub_link entries found." }));
    return section;
  }

  const list = createNode("ul");

  locationNodes.forEach((node) => {
    const item = createNode("li", { className: "tree-node" });
    const details = createNode("details");
    const summary = createNode("summary");

    summary.appendChild(createNode("code", { className: "key", text: node.name || node.id }));
    summary.appendChild(createNode("span", { className: "meta", text: node.category || "Location" }));
    if (node.start_year) {
      summary.appendChild(createNode("span", { className: "meta", text: String(node.start_year) }));
    }
    const sizeIndicator = buildSizeIndicator(node.size);
    if (sizeIndicator) {
      summary.appendChild(sizeIndicator);
    }

    summary.appendChild(createMuseumLinkButton(node.hub_link));
    if (typeof node.link === "string" && node.link.trim() !== "") {
      summary.appendChild(createWorldLinkButton(node.link));
    }

    details.appendChild(summary);
    wireDetailsToggle(details, summary);

    const body = createNode("div", { className: "branch-body" });
    const locationSnapshot = buildAboutSnapshot(node);
    const locationMetadataCount = countMetadataEntries(node, ["hub_link", "snapshotx200", "snapshot", "category", "size"]);
    const locationAboutCount = locationMetadataCount + (locationSnapshot ? 1 : 0);
    if (locationAboutCount > 1) {
      if (locationSnapshot) {
        body.appendChild(locationSnapshot);
      }
      const locationAboutList = createNode("ul", { className: "about-section" });
      locationAboutList.appendChild(buildMetadataItem("hub_link", node.hub_link));
      const locationMetadataList = buildMetadataList(node, ["hub_link", "snapshotx200", "snapshot", "category", "size"]);
      Array.from(locationMetadataList.children).forEach((child) => locationAboutList.appendChild(child));
      body.appendChild(locationAboutList);
    }
    const locationConnections = buildConnectedNodesSection(node.id, graph, 1, new Set(["0"]));
    if (locationConnections) {
      body.appendChild(locationConnections);
    }

    details.appendChild(body);
    item.appendChild(details);
    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
}

function buildGraphTree(nodeId, graph, depth = 0, path = new Set()) {
  const nodeData = graph.nodesById.get(nodeId);

  if (!nodeData) {
    const missing = createNode("li", { className: "tree-node" });
    missing.appendChild(
      createNode("div", { className: "value-line" }, [
        createNode("code", { className: "key", text: `${nodeId}:` }),
        createNode("span", { className: "value-empty", text: "missing node" })
      ])
    );
    return missing;
  }

  const item = createNode("li", { className: "tree-node" });
  const details = createNode("details", { open: depth === 0 });
  const summary = createNode("summary");
  const children = getDisplayChildren(nodeId, graph, path);

  summary.appendChild(createNode("code", { className: "key", text: nodeData.name || nodeData.id }));
  summary.appendChild(createNode("span", { className: "meta", text: nodeData.category || "Uncategorized" }));
  if (nodeData.start_year) {
    summary.appendChild(createNode("span", { className: "meta", text: String(nodeData.start_year) }));
  }
  const sizeIndicator = buildSizeIndicator(nodeData.size);
  if (sizeIndicator) {
    summary.appendChild(sizeIndicator);
  }

  if (children.length > 1) {
    summary.appendChild(
      createNode("span", {
        className: "meta",
        text: `${children.length} connected worlds`
      })
    );
  }
  if (typeof nodeData.hub_link === "string" && nodeData.hub_link.trim() !== "") {
    summary.appendChild(createMuseumLinkButton(nodeData.hub_link));
  }
  if (typeof nodeData.link === "string" && nodeData.link.trim() !== "") {
    summary.appendChild(createWorldLinkButton(nodeData.link));
  }

  details.appendChild(summary);
  wireDetailsToggle(details, summary);

  const branchBody = createNode("div", { className: "branch-body" });
  const snapshotPreview = buildAboutSnapshot(nodeData);
  const metadataCount = countMetadataEntries(nodeData, ["snapshotx200", "snapshot", "category", "size"]);
  const aboutCount = metadataCount + (snapshotPreview ? 1 : 0);
  if (aboutCount > 1) {
    if (snapshotPreview) {
      branchBody.appendChild(snapshotPreview);
    }
    const aboutList = buildMetadataList(nodeData, ["snapshotx200", "snapshot", "category", "size"]);
    aboutList.classList.add("about-section");
    branchBody.appendChild(aboutList);
  }

  if (nodeId === "0") {
    branchBody.appendChild(buildLocationsSection(graph));
  }
  const connectedNodesSection = buildConnectedNodesSection(nodeId, graph, depth, path);
  if (connectedNodesSection) {
    branchBody.appendChild(connectedNodesSection);
  }
  details.appendChild(branchBody);
  item.appendChild(details);
  return item;
}

function buildGraph(data) {
  const nodesById = new Map();
  const edgesBySource = new Map();
  const edgesByNode = new Map();

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

  return { nodesById, edgesBySource, edgesByNode };
}

async function loadGraph() {
  const response = await fetch("./vwm.json");
  if (!response.ok) {
    throw new Error(`Failed to load vwm.json: ${response.status}`);
  }

  return response.json();
}

loadGraph()
  .then((data) => {
    const graph = buildGraph(data);
    statusNode.textContent = `Loaded worlds catalog with ${graph.nodesById.size} worlds`;
    const rootList = createNode("ul", { className: "tree-root" }, [buildGraphTree("0", graph)]);
    treeNode.replaceChildren(rootList);
  })
  .catch((error) => {
    statusNode.textContent = "Unable to load vwm.json";
    treeNode.replaceChildren(
      createNode("pre", {
        className: "status",
        text: error instanceof Error ? error.message : String(error)
      })
    );
  });
