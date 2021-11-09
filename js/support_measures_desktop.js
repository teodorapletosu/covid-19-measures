// jshint ignore: start
/*global _,TARGET,$,block,unblock,context,setupPlugins,fetchDataset,setupContext,setupDiagram,setupMap,setupForms,applyMode,applyFilter*/

// eslint-disable-next-line
const setupFormFilters = opts => {
  const HTML_TEMPLATE = `
    <div data-form-field="mode" style="display: none">
      <ul class="nav nav-tabs justify-content-center">
        <li class="nav-item">
          <button type="button" class="nav-link <%- currentMode === 'count' ? 'active': '' %>" data-mode="count" title="Number of measures">
            <i class="fa fa-list-ol"></i>
            <span>Number of measures</span>
          </button>
        </li>
        <li class="nav-item">
          <button type="button" class="nav-link <%- currentMode === 'budget' ? 'active': '' %>" data-mode="budget" title="Budget references">
            <i class="fa fa-eur"></i>
            <span>Budget references</span>
          </button>
        </li>
      </ul>
    </div>

    <div data-form-field="filter">
      <div class="form-group">
        <label>
          <i class="fa fa-filter"></i>
          &nbsp;
          <span>Filters</span>
        </label>
        <select data-placeholder="None">
          <option></option>
          <% filters.forEach((filter) => { %>
            <optgroup label="<%- filter.label %>" data-filter="<%- filter %>">
            <% filter.items.forEach((item) => { %>
              <option data-item-id="<%- item.id %>" value="<%- item.id %>"><%- item.name %></option>
            <% }); %>
            </optgroup>
          <% }); %>
        </select>
      </div>
    </div>
  `;
  const templateContext = _.merge({}, opts, {
    currentMode: context.currentMode
  });
  const html = _.template(HTML_TEMPLATE)(templateContext);
  const $filtersForm = $(opts.outlet);
  $filtersForm.empty().append(html);
  // Filters for report
  const $filtersMode = $filtersForm.find('[data-form-field="mode"] button');
  $filtersMode.off("click").on("click", function() {
    $filtersMode.removeClass("active");
    const mode = $(this).attr("data-mode");
    $(this).addClass("active");
    api.setSelectedMode(mode);
  });
  // Filters for data
  const $filtersSelectDropdown = $filtersForm
    .find("[data-form-field='filter'] select")
    .select2({
      theme: "bootstrap4",
      width: "500px",
      placeholder: $(this).data("placeholder"),
      allowClear: true,
      minimumResultsForSearch: -1
    });
  $filtersSelectDropdown.on("select2:select", e => {
    const node_id = Number(e.params.data.id);
    let node = null;
    for (let f = 0; f < opts.filters.length; f++) {
      const filter = opts.filters[f];
      node = filter.items.find(it => it.id === node_id);
      if (node) {
        break;
      }
    }
    api.setSelectedFilter(node);
  });
  $filtersSelectDropdown.on("select2:clear", () => {
    api.setSelectedFilter(null);
  });
  const api = {
    setSelectedMode: mode => {
      context.currentMode = mode;
      applyMode();
    },
    setSelectedFilter: filter => {
      context.currentFilter = filter;
      if (filter) {
        const node = filter.type === "link" ? filter.source : filter;
        $filtersSelectDropdown.val(`${node.id}`);
        $filtersSelectDropdown.trigger("change");
        // Hack to show A vs B when clicking on links
        if (filter.type === "link") {
          const label = `${filter.source.name} vs ${filter.target.name}`;
          const $display = $filtersForm.find(".select2-selection__rendered");
          $display[0].childNodes[1].textContent = label;
        }
      }
      applyFilter();
    }
  };
  return api;
};

$(document).ready(() => {
  if (TARGET === "mobile") {
    window.location.href = "support_measures_mobile.html";
  }
  setupPlugins();
  block();
  fetchDataset()
    .then(ctx => setupContext(ctx))
    .then(() => setupDiagram())
    .then(() => setupMap())
    .then(() => setupForms())
    .then(() => unblock())
    .catch((err) => {
      console.error(err);
      unblock();
    });
  $(window).on("resize", () => {
    setupDiagram();
    if (context.map) {
      context.map.invalidateSize();
    }
  });
});
