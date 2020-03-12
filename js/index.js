'use strict';

(function() {
    // vars to hold ref to the unregister event listener functions
    let unregisterSettingsEventListener = null;
    let unregisterFilterEventListener = null;
    let unregisterMarkSelectionListener = null;
    let unregisterParameterEventListener = [];

    $(document).ready(function() {
        // add config option to call the config function
        tableau.extensions.initializeAsync({ 'configure': configure}).then(function() {
            renderCirclePacking();

            // add settings listeners
            unregisterSettingsEventListener = tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
                renderCirclePacking();
            });

            
        }, function() {console.log('Error while initializing: ' + err.toString());});
    });

    // main function to render the circle packing
    function renderCirclePacking() {
        $("#circlePack").text("");

        const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

        // unregister Event Listeners for old worksheet, if exists
        if (unregisterFilterEventListener != null) {
            unregisterFilterEventListener();
        }
        if (unregisterMarkSelectionListener != null) {
            unregisterMarkSelectionListener();
        }
        if (unregisterParameterEventListener != []) {
            unregisterParameterEventListener();
        }

        // try to get worksheet from settings, if it doesn't exist will show message saying to configure
        // else will hide the configuration instructions
        var sheetName = tableau.extensions.settings.get("worksheet");
        if (sheetName == undefined || sheetName == "" || sheetName == null) {
            $("#configure").show();
            
            // exit the function as there is no configuration
            return;
        } else {
            // if configuration exists then hide the config message
            $("#configure").hide().height(0);
        }

        // get the worksheet object from the worksheet name
        var worksheet = worksheets.find(function (sheet) {
            return sheet.name === sheetName;
        });

        // Add event listeners to the worksheet
        unregisterFilterEventListener = worksheet.addEventListener(tableau.TableauEventType.FilterChanged, (filterEvent) => {
            renderCirclePacking();
        });
        unregisterMarkSelectionListener = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, (markSelectionEvent) => {
            renderCirclePacking();
        });

        tableau.extensions.dashboardContent.dashboard.getParametersAsync().then(function(parameters) {
            parameters.forEach(function(p) {
                var unregParamEventListener = p.addEventListener(tableau.TableauEventType.ParameterChanged,function(parameterEvent) {
                    renderCirclePacking();
                });
                unregisterParameterEventListener.push(unregParamEventListener);
            });
        });


        // get settings
        var valueField = tableau.extensions.settings.get("valueField");
        var levelFields = tableau.extensions.settings.get("levelFields");
        var bgColour = tableau.extensions.settings.get("backgroundColour");
        var levelColours = tableau.extensions.settings.get("levelColours");
        var ttColour = tableau.extensions.settings.get("tooltipColour");
        var txtSize = tableau.extensions.settings.get("textSize");
        var txtColour = tableau.extensions.settings.get("textColour");

        // check value and level fields are defined as well as colours
        if (valueField != undefined && levelFields != undefined && bgColour != undefined && levelColours != undefined) {
            // get summary data from the worksheet
            worksheet.getSummaryDataAsync().then(function(sumdata) {
                // get value field
                var valueFieldSD = sumdata.columns.find(column => column.fieldName === valueField);

                // split level fields into array
                var levelFieldArr = [];
                levelFieldArr = levelFields.split("|");

                var levelFieldIdxArr = [];
                levelFieldArr.forEach(function(x) {
                    levelFieldIdxArr.push(sumdata.columns.find(column => column.fieldName === x).index);
                });

                var data = [];

                sumdata.data.forEach(function(dataRow) {
                    var row = {};
                    levelFieldIdxArr.forEach(function(i) {
                        var colName = sumdata.columns[i].fieldName;
                        var colVal = dataRow[i].formattedValue;
                        row[colName] = colVal;
                    });

                    var val = dataRow[valueFieldSD.index].value;
                    row["value"] = val;

                    data.push(row);
                });

                //root = d3.hierarchy(d3.rollups(data, v => d3.sum(v, d => d.value)

                var nData = d3.nest();
                levelFieldArr.forEach(function(lField) {
                    nData.key(function(d) {return d[lField];})
                });

                nData = nData.rollup(function(v) {return d3.sum(v, function(d) {return d.value; }); }).entries(data);

                nData = nData.map(function mapper(s) {
                    
                    if (Array.isArray(s.values)) {
                        return {
                            name: s.key,
                            children: s.values.map(mapper)
                        };
                    }
                    else {
                        return {
                            name: s.key,
                            value: s.value
                        };
                    }
                });

                var jData = {
                    name: "data",
                    children: nData
                };

                var circleDiv = document.getElementById("circlePack");
                var svg = d3.select(circleDiv).append("svg");

                function redraw() {
                    svg.text("");

                    var hData = d3.hierarchy(jData)
                        .sum(d => d.value)
                        .sort((a, b) => b.value - a.value);


                    var width = $("#circlePack").width();
                    var height = $("#circlePack").height();

                    var aspectRatio = width / height;

                    function pack(data) {
                        var p = d3.pack()
                            .size([width, height])
                            .padding(3)
                        return p(data);
                    }

                    var root = pack(hData);

                    // get colours
                    var levelColourArr = [];
                    levelColourArr = levelColours.split("|");


                    let focus = root;
                    let view;

                    svg.attr("preserveAspectRatio", "none")
                        .style("display", "block")
                        .style("background", bgColour)
                        .style("cursor", "pointer")
                        .on("click", () => zoom(root));

                    if (aspectRatio >= 1) {
                        svg.attr("viewBox", `-${((width)*aspectRatio) / 2} -${((height)*aspectRatio) / 2} ${(width) * aspectRatio} ${(height)*aspectRatio}`);
                    }
                    else {
                        svg.attr("viewBox",`-${(width + 50) / 2} -${(height + (50/aspectRatio)) / 2} ${width + 50} ${height + (50/aspectRatio)}`);
                    }

                    // define the tooltip
                    var tooltipDiv = d3.select("body").append("div")
                        .attr("class","tooltip")
                        .style("background", ttColour)
                        .style("opacity", 0);

                    const node = svg.append("g")
                        .selectAll("circle")
                        .data(root.descendants().slice(1))
                        .join("circle")
                        .attr("fill", d => levelColourArr[d.depth - 1])
                        //.attr("pointer-events", d=> !d.children ? "none" : null)
                        .on("mouseover", function(d) {
                            d3.select(this).attr("stroke", "#000"); 
                            tooltipDiv.transition()
                                .duration(200)
                                .style("opacity", .9);
                            // loop over parents up to depth 1 and concatenate the names
                            var displayName = d.data.name;
                            var parentD = d.parent;
                            for (var i = d.depth - 1; i >= 1; i--) {
                                displayName = parentD.data.name + " - " + displayName;
                                parentD = parentD.parent;
                            }
                            tooltipDiv.html(displayName + "<br/>" + intWithCommas(d.value))
                                .style("left", (d3.event.pageX) + "px")
                                .style("top", (d3.event.pageY - 28) + "px");
                        })
                        .on("mousemove", function(d) {
                            tooltipDiv
                                .style("left", (d3.event.pageX) + "px")
                                .style("top", (d3.event.pageY - 28) + "px");
                        })
                        .on("mouseout", function() {
                            d3.select(this).attr("stroke", null);
                            tooltipDiv.transition()
                                .duration(500)
                                .style("opacity", 0);
                         })
                        .on("click", d=> focus !== d && (zoom(d), d3.event.stopPropagation()));

                    const label = svg.append("g")
                        .attr("class", txtSize)
                        .attr("fill", txtColour)
                        .attr("pointer-events", "none")
                        .attr("text-anchor", "middle")
                        .selectAll("text")
                        .data(root.descendants())
                        .join("text")
                        .style("fill-opacity", d=> d.parent === root ? 1 : 0)
                        .style("display", d=> d.parent === root ? "inline" : "none")
                        .html(function(d) {
                            var dName = d.data.name;
                            var dValue = intWithCommas(d.value);
                            return dName + "<tspan x='0' dy='1.2em'>" + dValue + "</tspan>";
                        });

                    

                    
                    zoomTo([root.x, root.y, root.r * 2]);

                    function zoomTo(v) {
                        const k = width / v[2];

                        view = v;

                        label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
                        node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
                        node.attr("r", d => d.r * k);
                        
                    }

                    function zoom(d) {
                        const focus0 = focus;

                        focus = d;

                        const transition = svg.transition()
                            .duration(d3.event.altKey ? 7500 : 750)
                            .tween("zoom", d => {
                                const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                                return t => zoomTo(i(t));
                            });

                        label
                            .filter(function(d) {return d.parent === focus || this.style.display === "inline"; })
                            .transition(transition)
                            .style("fill-opacity", d => d.parent === focus ? 1 : 0)
                            .on("start", function(d) { 
                                if (d.parent === focus) this.style.display = "inline"; 
                            })
                            .on("end", function(d) { 
                                if (d.parent !== focus) this.style.display = "none"; 
                                removeOverlapLabels(svg);
                            });
                    }

                    removeOverlapLabels(svg);

                }

                redraw();

                window.addEventListener("resize", redraw);

            })
        }
        
    }

    // function for returning number as int with commas
    function intWithCommas(x) {
        return Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // function for removing overlapping labels
    function removeOverlapLabels(svg) {
        // remove overlapping labels
        // first get all showing labels
        var visibleLables = svg.selectAll("text[style*='inline'][transform]");
        // loop over each label
        visibleLables.each(function(d,i) {
            // get bounding box
            var thisBBox = this.getBBox();

            // get transform and split into x,y
            var thisTransform = d3.select(this).attr("transform");
            var trans = thisTransform.substring(thisTransform.indexOf("(")+1,thisTransform.indexOf(")")).split(",");

            // adjust bounding box x and y using transform
            thisBBox.x += parseFloat(trans[0]);
            thisBBox.y += parseFloat(trans[1]);

            // iterate through each box to see if it overlaps with any following
            // if they do, then hide them
            // only get labels after the current one
            visibleLables.filter((k, j) => j > i).each(function(d) {
                // get the comparing bounding box
                var underBBox = this.getBBox();

                // get transform and adjust as before
                var underTransform = d3.select(this).attr("transform");
                var underTrans = underTransform.substring(underTransform.indexOf("(")+1,underTransform.indexOf(")")).split(",");
                underBBox.x += parseFloat(underTrans[0]);
                underBBox.y += parseFloat(underTrans[1]);

                // compare the two and hide the second one if overlapping
                if (getOverlapFromTwoExtents(thisBBox,underBBox)) {
                    d3.select(this).style("display","none");
                }
            });
            
        });
    }

    // get overlap from two extents function - used to remove overlapping labels
    function getOverlapFromTwoExtents(l, r) {
        var overlapPadding = 0;

        l.left = l.x - overlapPadding;
        l.right = l.x + l.width + overlapPadding;
        l.top = l.y - overlapPadding;
        l.bottom = l.y + l.height + overlapPadding;

        r.left = r.x - overlapPadding;
        r.right = r.x + r.width + overlapPadding;
        r.top = r.y - overlapPadding;
        r.bottom = r.y + r.height + overlapPadding;

        var a = l;
        var b = r;

        if (a.left >= b.right || a.top >= b.bottom || a.right <= b.left || a.bottom <= b.top) {
            return false;
        } else {
            return true;
        }

    }

    // config button
    function configure() {
        const popupUrl = `${window.location.href.replace(/[^/]*$/, '')}/dialog.html`;

        let input = "";

        tableau.extensions.ui.displayDialogAsync(popupUrl, input, {height: 540, width: 950}).then((closePayload) => {

        }).catch((error) => {
            // one expected error condition is when the popup is closed by the user (clicking on the 'x')
            switch (error.errorCode) {
                case tableau.ErrorCodes.DialogClosedByUser:
                    console.log("Dialog was closed by user");
                    break;
                default:
                    console.log(error.message);
            }
        })
    }
})();