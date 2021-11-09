// jshint ignore: start
/*global _,$,block,unblock,context,setupPlugins,fetchDataset,setupContext,setupDiagram,setupMap,setupForms,applyMode,applyFilter*/

// eslint-disable-next-line
const setupFormFilters = opts => {
  const HTML_HEADER_TEMPLATE = `
    <li class="nav-item" data-form-field="mode">
      <div class="form-group">
        <div class="btn-group" role="group" aria-label="Report mode">
          <button type="button" class="btn btn-secondary <%- currentMode === 'count' ? 'active': '' %>" data-mode="count">
            <i class="fa fa-list-ol"></i>
            <span>Number of measures</span>
          </button>
          <!--
          <button type="button" class="btn btn-secondary <%- currentMode === 'budget' ? 'active': '' %>" data-mode="budget">
            <i class="fa fa-eur"></i>
            <span>Budget references</span>
          </button>
          -->
        </div>
      </div>
    </li>
  `;
  const HTML_FOOTER_TEMPLATE = `
    <li class="nav-item dropdown" data-form-field="filter">
      <div class="form-group">
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
    </li>
  `;
  const templateContext = _.merge({}, opts, {
    currentMode: context.currentMode
  });
  const htmlForHeader = _.template(HTML_HEADER_TEMPLATE)(templateContext);
  const htmlForFooter = _.template(HTML_FOOTER_TEMPLATE)(templateContext);

  const $headerFiltersForm = $(htmlForHeader);
  const $footerFiltersForm = $(htmlForFooter);

  $('.AppHeader [data-form-scope="filters"]')
    .empty()
    .append($headerFiltersForm);

  $('.AppFooter [data-form-scope="filters"]')
    .empty()
    .append($footerFiltersForm);

  // Filters for report
  const $filtersMode = $headerFiltersForm.find("button[data-mode]");
  $filtersMode.off("click").on("click", function() {
    $filtersMode.removeClass("active");
    const mode = $(this).attr("data-mode");
    $(this).addClass("active");
    api.setSelectedMode(mode);
  });
  // Filters for data
  const $filtersSelectDropdown = $footerFiltersForm.find("select").select2({
    theme: "bootstrap4",
    width: "100%",
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
          const $display = $footerFiltersForm.find(
            ".select2-selection__rendered"
          );
          $display[0].childNodes[1].textContent = label;
        }
      }
      applyFilter();
    }
  };
  return api;
};

$(document).ready(() => {
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
