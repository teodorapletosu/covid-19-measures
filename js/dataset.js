// jshint ignore: start
/*global XLSX,Papa*/

// const DATABASE_ID = "1lVSbpfw6O-ywAuRYz5YjMEZhK7eFgGOk2cCsbckzSwQ";
const DATABASE_ID = "1_K5xXjMu9kLe0hB2meQPkUz03JlCjQKSwmUuLqhulPg";
// eslint-disable-next-line
const fetchDataset = () => {
  const context = {
    dataProviders: {},
    merges: {}
  };
  const fetchCountries = () => {
    return fetch("data/COUNTRIES_ALL.json").then(re => re.json());
  };
  const fetchGraph = () => {
    const fileId = encodeURIComponent(DATABASE_ID);
    const fileFormat = "xlsx";
    // const fileUrl = `${window.location.protocol}//docs.google.com/spreadsheets/d/${fileId}/export?format=${encodeURIComponent(
    //   fileFormat
    // )}`;
    const fileUrl = `//us-central1-plasma-card-258813.cloudfunctions.net/proxy-sheet?id=${encodeURIComponent(
      fileId
    )}`;
    const decoders = {
      xlsx: re => {
        return re.arrayBuffer().then(arrayBuffer => {
          const data = new Uint8Array(arrayBuffer);
          const arr = [];
          for (let i = 0; i !== data.length; ++i) {
            arr[i] = String.fromCharCode(data[i]);
          }
          const bstr = arr.join("");
          const workbook = XLSX.read(bstr, { type: "binary" });
          const decodeSheet = sheetName => {
            // Records
            const currentSheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_row_object_array(currentSheet);
            const extractHeaders = ws => {
              const header = [];
              const columnCount = XLSX.utils.decode_range(ws["!ref"]).e.c + 1;
              for (let i = 0; i < columnCount; ++i) {
                header[i] = ws[`${XLSX.utils.encode_col(i)}1`].v;
              }
              return header;
            };
            const headers = extractHeaders(currentSheet);
            const extractMerges = ws => {
              const mergeInfo = ws["!merges"] || [];
              // console.debug(">> currentSheet", sheetName, mergeInfo);
              // CAVEAT: Horizontal merges should not be used
              const merges = mergeInfo.reduce((merges, merge) => {
                const rangeStartColumn = headers[merge.s.c];
                const rangeStartRow = merge.s.r;
                // const rangeEndColumn = headers[merge.e.c];
                const rangeEndRow = merge.e.r;
                // console.debug("Merge", merge, { rangeStartRow, rangeEndRow });
                for (let r = rangeStartRow; r <= rangeEndRow; r++) {
                  const rowIndex = r - 1;
                  const mergeValue = rows[rangeStartRow - 1][rangeStartColumn];
                  /*
                  const info = {
                    start: {
                      column: { header: rangeStartColumn, index: merge.s.c }
                    },
                    end: {
                      column: { header: rangeEndColumn, index: merge.e.c }
                    },
                    value: mergeValue
                  };
                  */
                  if (typeof merges[rowIndex] === "undefined") {
                    merges[rowIndex] = {};
                  }
                  merges[rowIndex][rangeStartColumn] = mergeValue;
                }
                return merges;
              }, {});
              return merges;
            };
            const merges = extractMerges(currentSheet);
            // Encodings and dictionaries
            // console.debug(workbook);
            if (workbook.SheetNames.length) {
              const headers = Object.keys(rows[0]);
              headers.forEach(header => {
                const indexOfSheet = workbook.SheetNames.indexOf(header);
                if (indexOfSheet !== -1) {
                  const headerSheet = workbook.Sheets[header];
                  const rows = XLSX.utils.sheet_to_row_object_array(
                    headerSheet
                  );
                  context.dataProviders[header] = rows;
                }
              });
            }
            return { headers, rows, merges };
          };
          return {
            Database: decodeSheet("Database"),
            Budgets: decodeSheet("Budgets")
          };
        });
      },
      csv: re => {
        return re.text().then(csv => {
          const { data } = Papa.parse(csv);
          const headers = data[0];
          const items = data.slice(1);
          const toObject = input =>
            headers.reduce((acc, it, idx) => {
              acc[it] = input[idx];
              return acc;
            }, {});
          const rows = items.map(it => toObject(it));
          return { headers, rows };
        });
      }
    };
    return fetch(fileUrl).then(re => {
      if (re.ok) {
        return decoders[fileFormat](re);
      }
      console.error("Error while fetching document", re);
      throw new Error("Cannot decode document");
    });
  };
  return Promise.all([fetchCountries(), fetchGraph()]).then(results => {
    const [countries, sheets] = results;
    context.dataSet = {
      countries,
      sheets
    };
    console.debug(sheets);
    return context;
  });
};
