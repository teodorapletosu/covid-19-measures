// jshint ignore: start
/*global $,device,d3,sk,L,_,accounting,marked,numeral,chroma,topojson,Split,setupFormFilters*/
const TARGET = device.mobile() ? "mobile" : "desktop";
// const EUROPE_NUTS2_REGIONS = "//gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_60M_2016_4326_LEVL_2.geojson";
// const COUNTRY_BORDERS = "//pkgstore.datahub.io/core/geo-countries/countries/archive/23f420f929e0e09c39d916b8aaa166fb/countries.geojson";
const COUNTRY_BORDERS = "data/countries.json";
const BRUSSELS_GPS = [50.8503, 4.3517];
const MAP_DEFAULT_CENTER = BRUSSELS_GPS;
const MAP_DEFAULT_ZOOM = 4.5;
// const MAP_THEME = "//europa.eu/webtools/maps/tiles/osm-ec/{z}/{x}/{y}.png";
// const MAP_THEME = "//tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";
const MAP_THEME = "//{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const MAP_ATTRIBUTION = "";
const COLORS_SECTOR = ["#b52375", "#edd1e1"];
const COLORS_MEASURE = ["#3f007d", "#e1d9e8"];
const COLUMN_FOR_SOURCE = "Sector";
const COLUMN_FOR_TARGET = "Type of support";
const COLUMN_FOR_BUDGET = "Budget (EUR)";
const COLUMN_FOR_DESCRIPTION = "Description";
const COLUMN_FOR_WEBLINK = "Web link";
const FILTER_MODE_BUDGET = "budget";
const FILTER_MODE_COUNT = "count";
const NUMBER_OF_MEASURES_EXCLUSIONS = [];
const BUDGET_REFERENCES_EXCLUSIONS = [
  "Not focused on CCS (i.e. all economic sectors)"
];
const HEADER_EXCLUSIONS = ["Country"];

// load a locale
numeral.register("locale", "en-custom", {
  delimiters: {
    thousands: " ",
    decimal: ","
  },
  abbreviations: {
    thousand: "thousand",
    million: "million",
    billion: "billion",
    trillion: "trillion"
  },
  ordinal: function(number) {
    return number === 1 ? "st" : "nd";
  },
  currency: {
    symbol: "€"
  }
});
numeral.locale("en-custom");

let context = {
  countryStyleMap: {},
  currentMode: FILTER_MODE_COUNT,
  currentFilter: null,
  dataSet: {},
  dataProviders: {}
};
const resetHighlight = () => {
  Object.values(context.map._layers).forEach(layer => {
    if (layer.feature && layer.feature.properties["ISO_A3"]) {
      layer.currentStyle =
        context.countryStyleMap[layer.feature.properties["ISO_A3"]];
      layer.setStyle(layer.currentStyle);
      // context.mapCountriesLayer.resetStyle(layer);
    }
  });
};
const highlightCountry = (countryName, customColor) => {
  const country = context.countriesMap[countryName];
  if (!country) {
    console.error("No such country", countryName);
    return;
  }
  const countryLayerId = country["alpha-3"];
  const countryLayer = Object.values(context.map._layers).find(
    it => it.feature && it.feature.properties["ISO_A3"] === countryLayerId
  );
  if (!countryLayer) {
    console.error("No such layer", countryLayerId);
    return;
  }
  countryLayer.currentStyle = {
    fillColor: customColor || "#FFAA34",
    weight: -1,
    opacity: 0.8,
    color: "#999",
    dashArray: "0",
    fillOpacity: 0.5
  };
  countryLayer.setStyle(countryLayer.currentStyle);
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    countryLayer.bringToFront();
  }
  return countryLayer;
};
const highlightCountries = (countries, color) => {
  const countriesLayers = countries.map(it => highlightCountry(it, color));
  const group = new L.featureGroup(countriesLayers);
  context.map.fitBounds(group.getBounds());
};
const highlightCountriesByNode = node => {
  removeCountriesHighlight();
  // Find countries matching nodes and highlight them
  const countriesMatchingNode = getCountriesMatchingNode(node);
  highlightCountries(countriesMatchingNode, node.color);
};
const highlightCountriesByLink = link => {
  removeCountriesHighlight();
  // Find countries having link
  const countriesMatchingLink = getCountriesMatchingLink(link);
  highlightCountries(countriesMatchingLink, "#000077");
};
const removeCountriesHighlight = () => {
  resetHighlight();
  context.map.closePopup();
};
const getCountriesMatchingNode = node => {
  const rowsMatchingNode = context.rows.filter(row => {
    return (
      row[COLUMN_FOR_SOURCE] === node.name ||
      row[COLUMN_FOR_TARGET] === node.name
    );
  });
  const countriesMatchingNode = _.uniq(
    rowsMatchingNode.map(row => row.Country)
  );
  return countriesMatchingNode;
};
const getCountriesMatchingLink = link => {
  const rowsMatchingNode = context.rows.filter(row => {
    return (
      row[COLUMN_FOR_SOURCE] === link.source.name &&
      row[COLUMN_FOR_TARGET] === link.target.name
    );
  });
  const countriesMatchingNode = _.uniq(
    rowsMatchingNode.map(row => row.Country)
  );
  return countriesMatchingNode;
};
// eslint-disable-next-line
const applyMode = () => {
  removeCountriesHighlight();
  context.mapReset();
  setupDiagram();
  setupForms();
};
// eslint-disable-next-line
const applyFilter = () => {
  const { currentFilter } = context;
  if (currentFilter) {
    if (currentFilter.type === "link") {
      highlightCountriesByLink(currentFilter);
    } else if (
      currentFilter.type === "sector" ||
      currentFilter.type === "measure"
    ) {
      highlightCountriesByNode(currentFilter);
    } else {
      console.warn("Unknown filter", currentFilter);
    }
  } else {
    removeCountriesHighlight();
    context.mapReset();
  }
};
const setupDiagram = opts => {
  const graph = createGraphDataFromRows();
  const configSankey = {
    margin: { top: 4, left: 4, right: 4, bottom: 61 },
    nodes: {
      width: 16,
      dynamicSizeFontNode: {
        enabled: true,
        minSize: 11,
        maxSize: 11
      },
      draggableX: false,
      draggableY: true,
      // colors: d3.scaleOrdinal(GRAPH_SCHEME),
      onClick: node => {
        context.filtersApi.setSelectedFilter(node);
      }
    },
    links: {
      formatValue: function(val) {
        if (context.currentMode === FILTER_MODE_BUDGET) {
          return `€ ${d3.format(",.2f")(val)}`;
        }
        return d3.format(",.0f")(val);
      },
      onClick: link => {
        context.filtersApi.setSelectedFilter(_.merge({ type: "link" }, link));
      }
    },
    tooltip: {
      infoDiv: true,
      labelSource: COLUMN_FOR_SOURCE,
      labelTarget: COLUMN_FOR_TARGET
    }
  };
  const objSankey = sk.createSankey(".AppDiagram", configSankey, graph);
  context.sankey = objSankey;
  context.sankey
    .getSVG()
    .append("defs")
    .append("style")
    .attr("type", "text/css")
    .text(
      `@import url('//fonts.googleapis.com/css2?family=DM+Sans&display=swap');`
    );
  return context;
};
// eslint-disable-next-line
const setupMap = () => {
  return fetch(COUNTRY_BORDERS)
    .then(re => re.json())
    .then(countriesData => {
      const cmAttr = MAP_ATTRIBUTION;
      const cmUrl = MAP_THEME;
      const minimal = L.tileLayer(cmUrl, {
        styleId: 22677,
        attribution: cmAttr
      });
      const map = L.map("AppMap", {
        layers: [minimal]
      });
      L.tileLayer(cmUrl, {
        zoom: 13,
        minZoom: 2,
        maxZoom: 18,
        attribution: cmAttr
      }).addTo(map);
      function style(feature) {
        const style = {
          fillColor: "transparent",
          weight: 1,
          opacity: 0.0,
          color: "#333",
          dashArray: "",
          fillOpacity: 0.5
        };
        context.countryStyleMap[feature.properties["ISO_A3"]] = style;
        return style;
      }
      const layerHighlightStyle = {
        fillColor: "#e5f5f9",
        weight: -1,
        opacity: 0.5,
        color: "#999",
        dashArray: "0",
        fillOpacity: 0.1
      };
      const layerSetup = {
        onEachFeature: (feature, layer) => {
          let prevStyle = null;
          layer.on({
            click: e => {
              // console.debug(e.target.feature);
            },
            mouseover: e => {
              prevStyle = layer.currentStyle;
              layer.setStyle(layerHighlightStyle);
            },
            mouseout: e => {
              if (!prevStyle) {
                context.mapCountriesLayer.resetStyle(layer);
              } else {
                layer.setStyle(prevStyle);
              }
            }
          });
        },
        style: style
      };
      const mapCountriesLayer = L.topoJson(countriesData, layerSetup)
        .bindPopup(
          layer => {
            const country = context.dataSet.countries.find(
              c => layer.feature.properties["ISO_A3"] === c["alpha-3"]
            );
            const countryRowsItems = context.rows.map((row, i) => {
              return Object.assign(row, { __index__: i });
            });
            const countryRows = countryRowsItems.filter(row => {
              return row.Country.toLowerCase() === country.name.toLowerCase();
            });
            const headers = context.dataSet.sheets.Database.headers.filter(
              it => HEADER_EXCLUSIONS.indexOf(it) === -1
            );
            let templateSource = "";
            if (countryRows.length === 0) {
              templateSource = `
                <div class="AppMapCountryLayerInfo">
                  <h1><span class="flag-icon flag-icon-<%= country['alpha-2'].toLowerCase() %> flag-icon-squared"></span> <%= country.name %></h1>
                  <div class="alert alert-info">
                    <strong>At the moment, there is no data for this country.</strong>
                    <p>The database is updated on a regular basis, please come back later!</p>
                  </div>
                </div>
              `;
            } else {
              templateSource = `
                <div class="AppMapCountryLayerInfo">
                  <h1><span class="flag-icon flag-icon-<%= country['alpha-2'].toLowerCase() %> flag-icon-squared"></span> <%= country.name %></h1>
                  <div class="AppMapCountryLayerInfoDetails">
                    <% if (details.length) { %>
                    <table class="table table-sm">
                      <% details.forEach((detail, index) => { %>
                        <%
                        headers.forEach((header) => {
                          const formatCell = formatters.cell[header] || formatters.cell['*'];
                        %>
                        <tr>
                        <td class="columnTitle"><%- header %></td>
                        <td class="columnValue"><%= formatCell(detail[header], header, detail) %></td>
                        </tr>
                        <% }) %>
                        <tr class="itemSeparator"><td colspan="2">&nbsp;</td></tr>
                      <% }) %>
                    </table>
                    <% } else { %>
                      <div class="alert alert-info">
                        <strong>There is no data for this country.</strong>
                        <% if (context.currentFilter) { %>
                        <p>Please refine or remove the current filter.</p>
                        <% } %>
                      </div>
                    <% } %>
                  </div>
                </div>
              `;
            }
            // console.debug(countryRows);
            let details = countryRows;
            if (context.currentFilter) {
              if (context.currentFilter.type === "sector") {
                details = details.filter(
                  d => d[COLUMN_FOR_SOURCE] === context.currentFilter.name
                );
              } else if (context.currentFilter.type === "measure") {
                details = details.filter(
                  d => d[COLUMN_FOR_TARGET] === context.currentFilter.name
                );
              } else if (context.currentFilter.type === "link") {
                details = details.filter(it => {
                  const isMatchingSource =
                    it[COLUMN_FOR_SOURCE] === context.currentFilter.source.name;
                  const isMatchingTarget =
                    it[COLUMN_FOR_TARGET] === context.currentFilter.target.name;
                  return isMatchingSource && isMatchingTarget;
                });
              }
            }
            const templateContext = {
              country,
              headers,
              details,
              currentFilter: context.currentFilter,
              formatters: {
                cell: {
                  "*": value => {
                    return _.template("<p><%- value %></p>")({
                      value
                    });
                  },
                  [COLUMN_FOR_WEBLINK]: (value, column, row) => {
                    return _.template(
                      '<span><i class="fa fa-external-link" aria-hidden="true"></i> <a href="<%- value %>" target="_blank">More info</a></span>'
                    )({
                      value
                    });
                  },
                  [COLUMN_FOR_SOURCE]: (value, column, row) => {
                    return _.template("<strong><%- value %></strong>")({
                      value
                    });
                  },
                  [COLUMN_FOR_TARGET]: (value, column, row) => {
                    return _.template("<strong><%- value %></strong>")({
                      value
                    });
                  },
                  [COLUMN_FOR_DESCRIPTION]: (value, column, row) => {
                    return `<div class="markdown-body">${marked(value)}</div>`;
                  },
                  [COLUMN_FOR_BUDGET]: (value, column, row) => {
                    /*
                    console.debug("Column for budget", {
                      value,
                      column,
                      row,
                      context
                    });
                    */
                    let sourceValue = value;
                    let sourceIsMergedValue = false;
                    const merges = context.merges[row.__index__];
                    if (merges) {
                      if (column in merges) {
                        sourceValue = merges[column];
                        sourceIsMergedValue = true;
                      }
                    }
                    const budgetValue = decodeBudget(sourceValue);
                    let budgetDisplay =
                      budgetValue === 0
                        ? "- n/a -"
                        : numeral(budgetValue).format("$ 0,0.00 a");
                    let icon = "fa-question";
                    let title = "Not available";
                    let allocation = "unknown";
                    if (sourceIsMergedValue) {
                      icon = "fa-share-alt";
                      title = "Shared budget";
                      allocation = "shared";
                    } else if (budgetValue > 0) {
                      icon = "fa-crosshairs";
                      title = "Dedicated budget";
                      allocation = "dedicated";
                    }
                    return _.template(`
                      <p data-budget-allocation="<%- allocation %>">
                        <i class="fa <%- icon %>" aria-hidden="true"></i>
                        <strong title="<%- title %>"><%- value %></strong>
                      </p>
                    `)({
                      value: budgetDisplay,
                      allocation: allocation,
                      icon: icon,
                      title: title
                    });
                  }
                }
              }
            };
            return _.template(templateSource)(templateContext);
          },
          {
            minWidth: 560,
            maxWidth: 560
          }
        )
        .addTo(map);

      // Add to context for reuse
      context.map = map;
      context.mapCountriesLayer = mapCountriesLayer;
      context.mapReset = () => {
        if (context.map) {
          context.map.invalidateSize();
          context.map.setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);
        }
        return context;
      };
      context.mapReset();
      return context;
    });
};

const decodeBudget = input => {
  let decodedBudgetValue = 0;
  const rawBudged = input;
  if (rawBudged) {
    const decodedBudget = accounting.unformat(rawBudged, ",");
    decodedBudgetValue = numeral(decodedBudget).value();
  }
  return decodedBudgetValue;
};

const numericSorter = (a, b) => b.value - a.value;
const createGraphDataFromRows = () => {
  let links = [];
  let nodes = [];
  const rows =
    context.currentMode === FILTER_MODE_BUDGET
      ? context.dataSet.sheets.Database.rows.filter(it => {
          const budget = decodeBudget(it[COLUMN_FOR_BUDGET]);
          const isExcluded =
            BUDGET_REFERENCES_EXCLUSIONS.indexOf(it[COLUMN_FOR_SOURCE]) !== -1;
          return budget > 0 && !isExcluded;
        })
      : context.dataSet.sheets.Database.rows.filter(it => {
          const isExcluded =
            NUMBER_OF_MEASURES_EXCLUSIONS.indexOf(it[COLUMN_FOR_SOURCE]) !== -1;
          return !isExcluded;
        });
  context.rows = rows;
  const sectors = _.uniq(rows.map(r => r[COLUMN_FOR_SOURCE]));
  const measures = _.uniq(rows.map(r => r[COLUMN_FOR_TARGET]));
  const entries = [].concat(sectors).concat(measures);
  const nodesMap = {};
  rows.forEach(row => {
    const sector = row[COLUMN_FOR_SOURCE];
    const measure = row[COLUMN_FOR_TARGET];
    const sectorId = entries.findIndex(e => e === sector);
    if (!nodesMap[sectorId]) {
      const node = {
        type: "sector",
        name: sector,
        sourceLinks: [],
        targetLinks: [],
        id: sectorId
      };
      nodes.push(node);
      nodesMap[sectorId] = node;
    }
    const measureId = entries.findIndex(e => e === measure);
    if (!nodesMap[measureId]) {
      const node = {
        type: "measure",
        name: measure,
        id: measureId
      };
      nodes.push(node);
      nodesMap[measureId] = node;
    }
    const source = nodes.findIndex(n => n.name === sector);
    const target = nodes.findIndex(n => n.name === measure);
    let currentLink = links.find(link => {
      return link.source === source && link.target === target;
    });
    const decodedBudgetValue = decodeBudget(row[COLUMN_FOR_BUDGET]);
    if (currentLink) {
      currentLink.count += 1;
      currentLink.budget += decodedBudgetValue;
    } else {
      const newLink = {
        source,
        target,
        count: 1,
        budget: decodedBudgetValue
      };
      links.push(newLink);
      currentLink = newLink;
    }
    if (context.currentMode === FILTER_MODE_BUDGET) {
      currentLink.value = currentLink.budget;
    } else {
      currentLink.value = currentLink.count;
    }
    nodes[source].targetLinks = links
      .filter(link => link.source === source)
      .sort(numericSorter);
    nodes[target].sourceLinks = links
      .filter(link => link.target === target)
      .sort(numericSorter);
  });
  links = links.sort(numericSorter);
  // colorize sector nodes
  const sectorNodes = nodes
    .filter(node => node.type === "sector")
    .sort((a, b) => {
      const totalTargetLinksA = _.sumBy(a.targetLinks, link => link.value);
      const totalTargetLinksB = _.sumBy(b.targetLinks, link => link.value);
      return totalTargetLinksB - totalTargetLinksA;
    });
  const sectorScheme = chroma
    .scale(COLORS_SECTOR)
    .mode("lch")
    .colors(sectorNodes.length);
  sectorNodes.forEach((node, index) => {
    node.color = sectorScheme[index];
  });
  // colorize measure nodes
  const measureNodes = nodes
    .filter(node => node.type === "measure")
    .sort((a, b) => {
      const totalSourceLinksA = _.sumBy(a.sourceLinks, link => link.value);
      const totalSourceLinksB = _.sumBy(b.sourceLinks, link => link.value);
      return totalSourceLinksB - totalSourceLinksA;
    });
  const measureScheme = chroma
    .scale(COLORS_MEASURE)
    .mode("lch")
    .colors(measureNodes.length);
  measureNodes.forEach((node, index) => {
    node.color = measureScheme[index];
  });
  context.sectors = sectorNodes;
  context.measures = measureNodes;
  const graph = {
    nodes,
    links
  };
  return graph;
};

const setupForms = () => {
  const $filtersFormContainer = $('[data-form-scope="filters"]');
  context.filtersApi = setupFormFilters({
    outlet: $filtersFormContainer,
    filter: "filter",
    label: "Filter",
    filters: [
      { label: COLUMN_FOR_SOURCE, items: context.sectors },
      { label: COLUMN_FOR_TARGET, items: context.measures }
    ]
  });
  return context;
};
// eslint-disable-next-line
const setupContext = ctx => {
  context = _.merge({}, context, ctx);
  context.countriesMap = _.reduce(
    context.dataSet.countries,
    (acc, it) => {
      acc[it.name] = it;
      return acc;
    },
    {}
  );
  context.rows = context.dataSet.sheets.Database.rows;
  context.merges = context.dataSet.sheets.Database.merges;
  return context;
};
// eslint-disable-next-line
const setupPlugins = () => {
  // Leaflet (topojson support)
  L.TopoJSON = L.GeoJSON.extend({
    addData: function(data) {
      var geojson, key;
      if (data.type === "Topology") {
        for (key in data.objects) {
          if (data.objects.hasOwnProperty(key)) {
            geojson = topojson.feature(data, data.objects[key]);
            L.GeoJSON.prototype.addData.call(this, geojson);
          }
        }
        return this;
      }
      L.GeoJSON.prototype.addData.call(this, data);
      return this;
    }
  });
  L.topoJson = function(data, options) {
    return new L.TopoJSON(data, options);
  };
  // Split (resizeable split view)
  if (TARGET !== "mobile") {
    Split(
      [
        '.AppContentPane[data-pane="diagram"]',
        '.AppContentPane[data-pane="map"]'
      ],
      {
        gutterSize: 5,
        onDrag: e => {
          $(window).trigger("resize");
        }
      }
    );
  }
};

console.debug('TARGET', TARGET);