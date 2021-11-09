const DATA_URL =
  "//docs.google.com/spreadsheets/d/1IlNSn4lsc2ZCD6pj-YW5rCX9za1vWOaS_kVp2XBAWy4/export?format=csv&id=1IlNSn4lsc2ZCD6pj-YW5rCX9za1vWOaS_kVp2XBAWy4&gid=0";
const COLUMN_FOR_COUNTRY = 0;
const COLUMN_FOR_PUBLIC_RATIO = 5;
const COLUMN_FOR_PRIVATE_RATIO = 6;
const COLUMN_FOR_GLOBAL_BUDGET = 1;
const COLUMN_FOR_CULTURE_BUDGET = 2;
const COLUMN_FOR_INDUSTRY_BUDGET = 3;
const CIRCLE_RADIUS = 25;
const SCALE_TYPE_LOG = "log";
const SCALE_TYPE_LIN = "lin";
const SCALE_TYPE_INITIAL = SCALE_TYPE_LIN;

// load a locale
numeral.register("locale", "en-custom", {
  delimiters: {
    thousands: " ",
    decimal: ","
  },
  abbreviations: {
    thousand: "k",
    million: "million",
    billion: "billion",
    trillion: "trillion"
  },
  ordinal: function(number) {
    return number === 1 ? "st" : "nd";
  },
  currency: {
    symbol: "Ã¢ÂÂ¬"
  }
});

numeral.locale("en-custom");

const fetchData = () =>
  fetch(DATA_URL)
    .then(re => re.text())
    .then(raw => Papa.parse(raw).data)
    .then(rows => {
      const headers = rows[0];
      const items = rows.slice(1);
      const countries = items.map(it => it[COLUMN_FOR_COUNTRY]);
      return {
        headers,
        items,
        countries
      };
    });

const decodeBudget = input => {
  let decodedBudgetValue = 0;
  const rawBudged = input;
  if (rawBudged) {
    const decodedBudget = accounting.unformat(rawBudged, ",");
    decodedBudgetValue = numeral(decodedBudget).value();
  }
  return decodedBudgetValue;
};

const decodeBudgetLabel = input => {
  const budgetColumn = input;
  const budgetNumber = decodeBudget(budgetColumn);
  let budgetLabel = numeral(budgetNumber).format("$ 0,0.00 a");
  if (budgetNumber === 0) {
    budgetLabel = budgetColumn;
  }
  return budgetLabel;
};

const renderTooltip = d => {
  const source = `
    <div class="CountryInfoTip">
      <table>
        <thead>
          <tr>
            <th colspan="2"><%- country %></th>
          </tr>
        </thead>
        <tbody>
        <% budgets.forEach(function(budget) { %>
          <tr>
            <td data-source="label"><strong><%- budget.label %></strong></td>
            <td data-source="value"><%- budget.value %></td>
          </tr>
        <% }) %>
        </tbody>
      </table>
    </div>
  `;
  const render = _.template(source);
  const html = render({
    country: d[COLUMN_FOR_COUNTRY],
    budgets: [
      {
        label: "Global public budget",
        value: decodeBudgetLabel(d[COLUMN_FOR_GLOBAL_BUDGET])
      },
      {
        label: "Culture public budget",
        value: decodeBudgetLabel(d[COLUMN_FOR_CULTURE_BUDGET])
      },
      {
        label: "Industry support",
        value: decodeBudgetLabel(d[COLUMN_FOR_INDUSTRY_BUDGET])
      }
    ]
  });
  return html;
};

$(document).ready(() => {
  fetchData().then(dataSet => {
    //  var x = 0.00195; var m = -Math.floor( Math.log(x) / Math.log(10) + 1);

    let preparedItems = JSON.parse(JSON.stringify(dataSet.items)).map(it => {
      it[COLUMN_FOR_PUBLIC_RATIO] = decodeBudget(it[COLUMN_FOR_PUBLIC_RATIO]);
      it[COLUMN_FOR_PRIVATE_RATIO] = decodeBudget(it[COLUMN_FOR_PRIVATE_RATIO]);
      it[COLUMN_FOR_CULTURE_BUDGET] = decodeBudget(
        it[COLUMN_FOR_CULTURE_BUDGET]
      );
      return it;
    });

    const dataX = preparedItems
      .map(it => it[COLUMN_FOR_PUBLIC_RATIO])
      .filter(it => it !== 0)
      .sort((a, b) => a - b);
    const powerX = -Math.floor(Math.log(dataX[0]) / Math.log(10) + 1) + 1;
    const factorX = Math.pow(10, powerX);

    const dataY = preparedItems
      .map(it => it[COLUMN_FOR_PRIVATE_RATIO])
      .filter(it => it !== 0)
      .sort((a, b) => a - b);
    const powerY = -Math.floor(Math.log(dataY[0]) / Math.log(10) + 1) + 1;
    const factorY = Math.pow(10, powerY);

    preparedItems = preparedItems.map(it => {
      it[COLUMN_FOR_PUBLIC_RATIO] = it[COLUMN_FOR_PUBLIC_RATIO] * factorX;
      it[COLUMN_FOR_PRIVATE_RATIO] = it[COLUMN_FOR_PRIVATE_RATIO] * factorY;
      return it;
    });

    window.reset = () => {
      $(".svgDiagram").empty();
      setupGraph(
        dataSet.countries,
        preparedItems,
        factorX,
        factorY,
        dataSet.items
      );
      setupTooltips(dataSet.items);
    };
    window.reset();

    function updateWindow() {
      window.reset();
    }
    $(window).on("resize", updateWindow);
  });
});

const getCountryColors = (data, logScaleX, xRange, logScaleY, yRange) => {
  let countryColorMap = {};
  const xScale = d3
    .scaleLog()
    .domain(logScaleX)
    .range(xRange);
  const yScale = d3
    .scaleLog()
    .domain(logScaleY)
    .range(yRange);

  const nodes = data.map(d => ({
    id: d[COLUMN_FOR_COUNTRY],
    cx: xScale(d[COLUMN_FOR_PUBLIC_RATIO]),
    cy: yScale(d[COLUMN_FOR_PRIVATE_RATIO])
  }));
  const centers = nodes.map(d => {
    return [d.cx, d.cy];
  });
  const clusters = clustering.kmeans(centers);
  const clustersColors = chroma
    .scale(["red", "blue"])
    .mode("lch")
    .colors(clusters.length);
  const clusterCountries = clusters.map((centers, index) => {
    const cluster = centers.map(center => {
      return nodes.find(
        node =>
          Math.floor(node.cx) === Math.floor(center[0]) &&
          Math.floor(node.cy) === Math.floor(center[1])
      );
    });
    cluster.color = clustersColors[index];
    return cluster;
  });
  countryClusterColorMap = clusterCountries.reduce((acc, cluster) => {
    cluster.forEach(it => {
      acc[it.id] = cluster.color;
    });
    return acc;
  }, countryColorMap);
  // console.debug(data, centers, countryColorMap);
  return countryColorMap;
};

const setupTooltips = items => {
  $("#svgStage circle").tooltipster({
    contentAsHTML: true,
    plugins: ["follower"],
    animation: "fade",
    delay: 0,
    functionInit: function(instance, helper) {
      const country = helper.origin.getAttribute("data-country");
      const row = items.find(d => d[COLUMN_FOR_COUNTRY] === country);
      instance.content(renderTooltip(row));
    }
  });
};

const setupGraph = (countries, items, factorX, factorY, originalDataset) => {
  const country_colors = chroma
    .scale(["#fafa6e", "#2A4858"])
    .mode("lch")
    .colors(countries.length);

  const w = $(".svgDiagram").width();
  const h = $(".svgDiagram").height();

  const margin = { top: 50, right: 25, bottom: 130, left: 95 };

  const svgStage = d3
    .select(".svgDiagram")
    .append("svg")
    .attr("id", "svgStage")
    .attr("width", w)
    .attr("height", h)
    .call(
      d3.zoom().on("zoom", function() {
        svg.attr("transform", d3.event.transform);
      })
    );

  svgStage
    .append("svg:defs")
    .append("svg:marker")
    .attr("id", "triangle")
    .attr("refX", 6)
    .attr("refY", 6)
    .attr("markerWidth", 30)
    .attr("markerHeight", 30)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 12 6 0 12 3 6")
    .style("fill", "#cccccc");

  const svg = svgStage.append("g");

  // colour scale for regions
  const colours = d3
    .scaleOrdinal()
    .domain(countries)
    .range(country_colors);

  // load data
  const plot = input => {
    let scaleType = SCALE_TYPE_INITIAL;
    let dataset = input.filter(it => {
      const exclude =
        it[COLUMN_FOR_PUBLIC_RATIO] === 0 && it[COLUMN_FOR_PRIVATE_RATIO] === 0;
      return !exclude;
    });
    const bMin = d3.min(dataset, function(d) {
      return d[COLUMN_FOR_CULTURE_BUDGET];
    });
    const bMax = d3.max(dataset, function(d) {
      return d[COLUMN_FOR_CULTURE_BUDGET];
    });
    const bDomain = [bMin, bMax];
    const bRange = [5, 60];
    const bScale = d3
      .scaleLog()
      .domain(bDomain)
      .range(bRange);

    // Compute x axis requirements
    const xRange = [margin.left, w - margin.left - margin.right];
    const xMin = 0;
    const xMax = d3.max(dataset, function(d) {
      return d[COLUMN_FOR_PUBLIC_RATIO];
    });
    // x tweek
    const datasetXNonZero = dataset
      .map(d => d[COLUMN_FOR_PUBLIC_RATIO])
      .filter(it => it !== 0);
    const logScaleXMin = d3.min(datasetXNonZero);
    const logScaleXMax = d3.max(datasetXNonZero);
    const logScaleX = [1, logScaleXMax];

    // y tweek
    const datasetYNonZero = dataset
      .map(d => d[COLUMN_FOR_PRIVATE_RATIO])
      .filter(it => it !== 0);
    const logScaleYMin = d3.min(datasetYNonZero);
    const logScaleYMax = d3.max(datasetYNonZero);
    const logScaleY = [1, logScaleYMax];

    dataset = dataset.map(d => {
      if (d[COLUMN_FOR_PUBLIC_RATIO] === 0) {
        d[COLUMN_FOR_PUBLIC_RATIO] = logScaleXMin / 2;
      }
      if (d[COLUMN_FOR_PRIVATE_RATIO] === 0) {
        d[COLUMN_FOR_PRIVATE_RATIO] = logScaleYMin / 2;
      }
      return d;
    });

    let xAxis = d3
      .axisBottom()
      .tickFormat((d, index) => {
        if (scaleType === SCALE_TYPE_LOG) {
          if (index % 2 === 0) {
            return "";
          }
        }
        return d3.format(",")(d / factorX);
      })
      .tickSize(-(h - (margin.top + margin.bottom)))
      .ticks(5);

    svg
      .append("line")
      .attr("x1", margin.left)
      .attr("y1", h - margin.bottom + 65)
      .attr("x2", w - margin.right)
      .attr("y2", h - margin.bottom + 65)
      .attr("stroke-width", 1)
      .attr("stroke", "#cccccc")
      .attr("marker-end", "url(#triangle)");

    // Compute y axis requirements
    const yRange = [h - margin.bottom, margin.top];
    const yMin = 0;
    const yMax = d3.max(dataset, function(d) {
      return d[COLUMN_FOR_PRIVATE_RATIO];
    });
    let yAxis = d3
      .axisLeft()
      .tickFormat((d, index) => {
        if (scaleType === SCALE_TYPE_LOG) {
          if (index % 2 === 0) {
            return "";
          }
        }
        return d3.format(",")(d / factorX);
      })
      .tickSize(-(w - (margin.left + margin.right)))
      .ticks(5);

    svg
      .append("line")
      .attr("x1", margin.left - 65)
      .attr("y1", margin.top)
      .attr("x2", margin.left - 65)
      .attr("y2", h - 130)
      .attr("stroke-width", 1)
      .attr("stroke", "#cccccc")
      .attr("marker-start", "url(#triangle)");

    const applyScale = scaleType => {
      let xScale, yScale;
      if (scaleType === SCALE_TYPE_LOG) {
        xScale = d3
          .scaleLog()
          .domain(logScaleX)
          .range(xRange);
        yScale = d3
          .scaleLog()
          .domain(logScaleY)
          .range(yRange);
      } else {
        xScale = d3
          .scaleLinear()
          .domain([xMin, xMax])
          .range(xRange);
        yScale = d3
          .scaleLinear()
          .domain([yMin, yMax])
          .range(yRange);
      }

      // Rescale X
      xAxis.scale(xScale);
      d3.select("g.axis.x")
        .transition()
        .duration(500)
        .call(xAxis)
        .selectAll("text")
        .filter(function(node) {
          return this.getAttribute("data-purpose") !== "label";
        })
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-90)");

      // Rescale Y
      yAxis.scale(yScale);
      d3.select("g.axis.y")
        .transition()
        .duration(500)
        .call(yAxis);

      d3.selectAll("circle")
        .transition()
        .delay(400)
        .duration(600)
        .attr("cx", function(d) {
          const xValue = d[COLUMN_FOR_PUBLIC_RATIO];
          return xScale(xValue);
        })
        .attr("cy", function(d) {
          const yValue = d[COLUMN_FOR_PRIVATE_RATIO];
          return yScale(yValue);
        });

      d3.selectAll("text")
        .transition()
        .delay(400)
        .duration(600)
        .filter(function(node) {
          return this.getAttribute("data-purpose") === "label";
        })
        .attr("x", function(d) {
          return xScale(d[COLUMN_FOR_PUBLIC_RATIO]);
        })
        .attr("y", function(d) {
          return yScale(d[COLUMN_FOR_PRIVATE_RATIO]);
        })
        .attr("dy", ".35em")
        .attr("text-anchor", "middle");

      return { xScale, yScale };
    };

    let { xScale, yScale } = applyScale(scaleType);

    svg
      .append("g")
      .attr("class", "axis x")
      .attr("transform", "translate(0," + (h - margin.bottom) + ")")
      .call(xAxis)
      .selectAll("text")
      .filter(function(node) {
        return this.getAttribute("data-purpose") !== "label";
      })
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-90)");

    svg
      .append("g")
      .attr("class", "axis y")
      .attr("transform", "translate(" + margin.left + ",0)")
      .call(yAxis);

    const node = svg
      .selectAll("circle")
      .data(dataset)
      .enter();

    const texts = node
      .append("text")
      .attr("data-purpose", "label")
      .text(function(d) {
        return d[COLUMN_FOR_COUNTRY];
      })
      .attr("x", function(d) {
        return xScale(d[COLUMN_FOR_PUBLIC_RATIO]);
      })
      .attr("y", function(d) {
        return yScale(d[COLUMN_FOR_PRIVATE_RATIO]);
      })
      .attr("dy", ".35em")
      .attr("text-anchor", "middle");

    const fillMap = getCountryColors(
      dataset,
      logScaleX,
      xRange,
      logScaleY,
      yRange
    );

    const circles = node
      .append("circle")
      .attr("data-country", function(d) {
        return d[COLUMN_FOR_COUNTRY];
      })
      .attr("cx", function(d) {
        return xScale(d[COLUMN_FOR_PUBLIC_RATIO]);
      })
      .attr("cy", function(d) {
        return yScale(d[COLUMN_FOR_PRIVATE_RATIO]);
      })
      .attr("r", function(d) {
        return bScale(d[COLUMN_FOR_CULTURE_BUDGET]);
      })
      .style("fill", function(d) {
        return fillMap[d[COLUMN_FOR_COUNTRY]];
      });

    const xLegends = svg.append("g");
    xLegends
      .append("text")
      .attr("class", "x title shadow")
      .attr("text-anchor", "start")
      .attr(
        "transform",
        "translate(" + (margin.left + 5) + "," + (h - margin.bottom + 50) + ")"
      )
      .text("Global support");
    xLegends
      .append("text")
      .attr("class", "x title shadow")
      .attr("text-anchor", "end")
      .attr(
        "transform",
        "translate(" +
          (w - margin.right - 5) +
          "," +
          (h - margin.bottom + 50) +
          ")"
      )
      .text("Culture support");

    const yLegends = svg.append("g");
    yLegends
      .append("text")
      .attr("class", "y title shadow")
      .attr("text-anchor", "start")
      .attr(
        "transform",
        "translate(" +
          (margin.left - 40) +
          "," +
          (h - margin.bottom + 5) +
          ") rotate(-90)"
      )
      .text("Public support");
    yLegends
      .append("text")
      .attr("class", "y title shadow")
      .attr("text-anchor", "end")
      .attr(
        "transform",
        "translate(" +
          (margin.left - 40) +
          "," +
          (margin.top + 5) +
          ") rotate(-90)"
      )
      .text("Industry support");

    /*
    // legend
    const legendMargin = { top: 12, right: 5, bottom: 10, left: 5 };
    const legendW = 100;
    const rectSize = 15;
    const rowHeight = 16;
    const legendH = rowHeight * countries.length + 8;
    const svgLegend = svg
      .append("svg")
      .attr("width", legendW)
      .attr("height", legendH)
      .attr("x", w - legendW)
      .attr("y", margin.top);
    const legendContainer = svgLegend
      .append("g")
      .attr("class", "legendContainer")
      .attr(
        "transform",
        "translate(" + legendMargin.left + "," + legendMargin.top + ")"
      );
    const legend = legendContainer
      .selectAll(".legendSquare")
      .data(colours.range())
      .enter()
      .append("g")
      .attr("class", "legendSquare")
      .attr("transform", function(d, i) {
        return "translate(0," + i * rowHeight + ")";
      });

    // append squares to legend
    legend
      .append("rect")
      .attr("width", rectSize)
      .attr("height", rectSize)
      .style("fill", function(d) {
        return d;
      });
    // append text to legend
    legend
      .append("text")
      .attr("transform", "translate(20," + rectSize / 2 + ")")
      .attr("class", "legendText shadow")
      .attr("dy", 0)
      .text(function(d, i) {
        return colours.domain()[i];
      });
      */

    $(".scaleMode > button")
      .off("click")
      .on("click", e => {
        const $sender = $(e.currentTarget);
        scaleType = $sender.attr("data-scale-type");
        const info = applyScale(scaleType);
        xScale = info.xScale;
        yScale = info.yScale;
        // activate button
        $(".scaleMode > button").removeClass("active");
        $sender.addClass("active");
      });

    $(".scaleMode > button")
      .filter(`[data-scale-type="${scaleType}"]`)
      .addClass("active");
  };

  plot(items);
};
