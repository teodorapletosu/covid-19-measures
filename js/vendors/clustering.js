(function webpackUniversalModuleDefinition(root, factory) {
  //Clustering
  if (typeof exports === "object" && typeof module === "object")
    module.exports = factory();
  //Clustering
  else if (typeof define === "function" && define.amd) define([], factory);
  //Clustering
  else if (typeof exports === "object") exports["clustering"] = factory();
  //Clustering
  else root["clustering"] = factory();
})(window, function() {
  return /******/ (function(modules) {
    // webpackBootstrap
    /******/ // The module cache
    /******/ var installedModules = {}; // The require function
    /******/
    /******/ /******/ function __webpack_require__(moduleId) {
      /******/
      /******/ // Check if module is in cache
      /******/ if (installedModules[moduleId]) {
        /******/ return installedModules[moduleId].exports;
        /******/
      } // Create a new module (and put it into the cache)
      /******/ /******/ var module = (installedModules[moduleId] = {
        /******/ i: moduleId,
        /******/ l: false,
        /******/ exports: {}
        /******/
      }); // Execute the module function
      /******/
      /******/ /******/ modules[moduleId].call(
        module.exports,
        module,
        module.exports,
        __webpack_require__
      ); // Flag the module as loaded
      /******/
      /******/ /******/ module.l = true; // Return the exports of the module
      /******/
      /******/ /******/ return module.exports;
      /******/
    } // expose the modules object (__webpack_modules__)
    /******/
    /******/
    /******/ /******/ __webpack_require__.m = modules; // expose the module cache
    /******/
    /******/ /******/ __webpack_require__.c = installedModules; // define getter function for harmony exports
    /******/
    /******/ /******/ __webpack_require__.d = function(exports, name, getter) {
      /******/ if (!__webpack_require__.o(exports, name)) {
        /******/ Object.defineProperty(exports, name, {
          enumerable: true,
          get: getter
        });
        /******/
      }
      /******/
    }; // define __esModule on exports
    /******/
    /******/ /******/ __webpack_require__.r = function(exports) {
      /******/ if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
        /******/ Object.defineProperty(exports, Symbol.toStringTag, {
          value: "Module"
        });
        /******/
      }
      /******/ Object.defineProperty(exports, "__esModule", { value: true });
      /******/
    }; // create a fake namespace object // mode & 1: value is a module id, require it // mode & 2: merge all properties of value into the ns // mode & 4: return value when already ns object // mode & 8|1: behave like require
    /******/
    /******/ /******/ /******/ /******/ /******/ /******/ __webpack_require__.t = function(
      value,
      mode
    ) {
      /******/ if (mode & 1) value = __webpack_require__(value);
      /******/ if (mode & 8) return value;
      /******/ if (
        mode & 4 &&
        typeof value === "object" &&
        value &&
        value.__esModule
      )
        return value;
      /******/ var ns = Object.create(null);
      /******/ __webpack_require__.r(ns);
      /******/ Object.defineProperty(ns, "default", {
        enumerable: true,
        value: value
      });
      /******/ if (mode & 2 && typeof value != "string")
        for (var key in value)
          __webpack_require__.d(
            ns,
            key,
            function(key) {
              return value[key];
            }.bind(null, key)
          );
      /******/ return ns;
      /******/
    }; // getDefaultExport function for compatibility with non-harmony modules
    /******/
    /******/ /******/ __webpack_require__.n = function(module) {
      /******/ var getter =
        module && module.__esModule
          ? /******/ function getDefault() {
              return module["default"];
            }
          : /******/ function getModuleExports() {
              return module;
            };
      /******/ __webpack_require__.d(getter, "a", getter);
      /******/ return getter;
      /******/
    }; // Object.prototype.hasOwnProperty.call
    /******/
    /******/ /******/ __webpack_require__.o = function(object, property) {
      return Object.prototype.hasOwnProperty.call(object, property);
    }; // __webpack_public_path__
    /******/
    /******/ /******/ __webpack_require__.p = ""; // Load entry module and return exports
    /******/
    /******/
    /******/ /******/ return __webpack_require__((__webpack_require__.s = 2));
    /******/
  })(
    /************************************************************************/
    /******/ [
      /* 0 */
      /***/ function(module, exports) {
        module.exports = {
          euclidean: function(v1, v2) {
            var total = 0;
            for (var i = 0; i < v1.length; i++) {
              total += Math.pow(v2[i] - v1[i], 2);
            }
            return Math.sqrt(total);
          },
          manhattan: function(v1, v2) {
            var total = 0;
            for (var i = 0; i < v1.length; i++) {
              total += Math.abs(v2[i] - v1[i]);
            }
            return total;
          },
          max: function(v1, v2) {
            var max = 0;
            for (var i = 0; i < v1.length; i++) {
              max = Math.max(max, Math.abs(v2[i] - v1[i]));
            }
            return max;
          }
        };

        /***/
      },
      /* 1 */
      /***/ function(module, exports, __webpack_require__) {
        var distances = __webpack_require__(0);

        function KMeans(centroids, opts) {
          this.centroids = centroids || [];
          this.opts = opts;
        }

        KMeans.prototype.randomCentroids = function(points, k) {
          var centroids = points.slice(0); // copy
          // console.debug(centroids);
          centroids = centroids.reverse();
          return centroids.slice(0, k);
        };

        KMeans.prototype.classify = function(point, distance) {
          var min = Infinity,
            index = 0;

          distance = distance || "euclidean";
          if (typeof distance == "string") {
            distance = distances[distance];
          }

          for (var i = 0; i < this.centroids.length; i++) {
            var dist = distance(point, this.centroids[i]);
            if (dist < min) {
              min = dist;
              index = i;
            }
          }

          return index;
        };

        KMeans.prototype.cluster = function(
          points,
          k,
          distance,
          snapshotPeriod,
          snapshotCb
        ) {
          k = k || Math.max(2, Math.ceil(Math.sqrt(points.length / 2)));

          distance = distance || "euclidean";
          if (typeof distance == "string") {
            distance = distances[distance];
          }

          this.centroids = this.randomCentroids(points, k);

          var assignment = new Array(points.length);
          var clusters = new Array(k);

          var iterations = 0;
          var movement = true;
          while (movement) {
            // update point-to-centroid assignments
            for (var i = 0; i < points.length; i++) {
              assignment[i] = this.classify(points[i], distance);
            }

            // update location of each centroid
            movement = false;
            for (var j = 0; j < k; j++) {
              var assigned = [];
              for (var i = 0; i < assignment.length; i++) {
                if (assignment[i] == j) {
                  assigned.push(points[i]);
                }
              }

              if (!assigned.length) {
                continue;
              }

              var centroid = this.centroids[j];
              var newCentroid = new Array(centroid.length);

              for (var g = 0; g < centroid.length; g++) {
                var sum = 0;
                for (var i = 0; i < assigned.length; i++) {
                  sum += assigned[i][g];
                }
                newCentroid[g] = sum / assigned.length;

                if (newCentroid[g] != centroid[g]) {
                  movement = true;
                }
              }

              this.centroids[j] = newCentroid;
              clusters[j] = assigned;
            }

            if (snapshotCb && iterations++ % snapshotPeriod == 0) {
              snapshotCb(clusters);
            }
          }

          return clusters;
        };

        KMeans.prototype.toJSON = function() {
          return JSON.stringify(this.centroids);
        };

        KMeans.prototype.fromJSON = function(json) {
          this.centroids = JSON.parse(json);
          return this;
        };

        module.exports = KMeans;

        module.exports.kmeans = function(vectors, k, opts) {
          return new KMeans([], opts).cluster(vectors, k);
        };

        /***/
      },
      /* 2 */
      /***/ function(module, exports, __webpack_require__) {
        module.exports = {
          hcluster: __webpack_require__(3),
          Kmeans: __webpack_require__(1),
          kmeans: __webpack_require__(1).kmeans
        };

        /***/
      },
      /* 3 */
      /***/ function(module, exports, __webpack_require__) {
        var distances = __webpack_require__(0);

        var HierarchicalClustering = function(distance, linkage, threshold) {
          this.distance = distance;
          this.linkage = linkage;
          this.threshold = threshold == undefined ? Infinity : threshold;
        };

        HierarchicalClustering.prototype = {
          cluster: function(items, snapshotPeriod, snapshotCb) {
            this.clusters = [];
            this.dists = []; // distances between each pair of clusters
            this.mins = []; // closest cluster for each cluster
            this.index = []; // keep a hash of all clusters by key

            for (var i = 0; i < items.length; i++) {
              var cluster = {
                value: items[i],
                key: i,
                index: i,
                size: 1
              };
              this.clusters[i] = cluster;
              this.index[i] = cluster;
              this.dists[i] = [];
              this.mins[i] = 0;
            }

            for (var i = 0; i < this.clusters.length; i++) {
              for (var j = 0; j <= i; j++) {
                var dist =
                  i == j
                    ? Infinity
                    : this.distance(
                        this.clusters[i].value,
                        this.clusters[j].value
                      );
                this.dists[i][j] = dist;
                this.dists[j][i] = dist;

                if (dist < this.dists[i][this.mins[i]]) {
                  this.mins[i] = j;
                }
              }
            }

            var merged = this.mergeClosest();
            var i = 0;
            while (merged) {
              if (snapshotCb && i++ % snapshotPeriod == 0) {
                snapshotCb(this.clusters);
              }
              merged = this.mergeClosest();
            }

            this.clusters.forEach(function(cluster) {
              // clean up metadata used for clustering
              delete cluster.key;
              delete cluster.index;
            });

            return this.clusters;
          },

          mergeClosest: function() {
            // find two closest clusters from cached mins
            var minKey = 0,
              min = Infinity;
            for (var i = 0; i < this.clusters.length; i++) {
              var key = this.clusters[i].key,
                dist = this.dists[key][this.mins[key]];
              if (dist < min) {
                minKey = key;
                min = dist;
              }
            }
            if (min >= this.threshold) {
              return false;
            }

            var c1 = this.index[minKey],
              c2 = this.index[this.mins[minKey]];

            // merge two closest clusters
            var merged = {
              left: c1,
              right: c2,
              key: c1.key,
              size: c1.size + c2.size
            };

            this.clusters[c1.index] = merged;
            this.clusters.splice(c2.index, 1);
            this.index[c1.key] = merged;

            // update distances with new merged cluster
            for (var i = 0; i < this.clusters.length; i++) {
              var ci = this.clusters[i];
              var dist;
              if (c1.key == ci.key) {
                dist = Infinity;
              } else if (this.linkage == "single") {
                dist = this.dists[c1.key][ci.key];
                if (this.dists[c1.key][ci.key] > this.dists[c2.key][ci.key]) {
                  dist = this.dists[c2.key][ci.key];
                }
              } else if (this.linkage == "complete") {
                dist = this.dists[c1.key][ci.key];
                if (this.dists[c1.key][ci.key] < this.dists[c2.key][ci.key]) {
                  dist = this.dists[c2.key][ci.key];
                }
              } else if (this.linkage == "average") {
                dist =
                  (this.dists[c1.key][ci.key] * c1.size +
                    this.dists[c2.key][ci.key] * c2.size) /
                  (c1.size + c2.size);
              } else {
                dist = this.distance(ci.value, c1.value);
              }

              this.dists[c1.key][ci.key] = this.dists[ci.key][c1.key] = dist;
            }

            // update cached mins
            for (var i = 0; i < this.clusters.length; i++) {
              var key1 = this.clusters[i].key;
              if (this.mins[key1] == c1.key || this.mins[key1] == c2.key) {
                var min = key1;
                for (var j = 0; j < this.clusters.length; j++) {
                  var key2 = this.clusters[j].key;
                  if (this.dists[key1][key2] < this.dists[key1][min]) {
                    min = key2;
                  }
                }
                this.mins[key1] = min;
              }
              this.clusters[i].index = i;
            }

            // clean up metadata used for clustering
            delete c1.key;
            delete c2.key;
            delete c1.index;
            delete c2.index;

            return true;
          }
        };

        var hcluster = function(
          items,
          distance,
          linkage,
          threshold,
          snapshot,
          snapshotCallback
        ) {
          distance = distance || "euclidean";
          linkage = linkage || "average";

          if (typeof distance == "string") {
            distance = distances[distance];
          }
          var clusters = new HierarchicalClustering(
            distance,
            linkage,
            threshold
          ).cluster(items, snapshot, snapshotCallback);

          if (threshold === undefined) {
            return clusters[0]; // all clustered into one
          }
          return clusters;
        };

        module.exports = hcluster;

        /***/
      }
      /******/
    ]
  );
});
