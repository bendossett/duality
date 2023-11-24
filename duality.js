const WIDTH = 5;
const HEIGHT = 5;

let CANVAS_WIDTH = 600;
let CANVAS_HEIGHT = 600;

const dragThreshold = 0.1;

let primal;
let dual;

let drawSegments = true;

let scaleFactor = 1.0;
let offsetX = 0.0;
let offsetY = 0.0;
let targetOffsetX = 0.0;
let targetOffsetY = 0.0;

const colors = [];
let colorCount = 0;

window.onload = () => {
    document.querySelector("#mode-select").addEventListener("click", setModeStatus);
}

function setModeStatus() {
    drawSegments = !drawSegments;

    if (drawSegments) {
        document.querySelector("#mode-status").innerHTML = "SEGMENT";
    } else {
        document.querySelector("#mode-status").innerHTML = "LINE";
    }
}

// From p5.js
function map(n, start1, stop1, start2, stop2) {
    return (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
};

function canvas2coord(px, py) {
    const scale = 1 / scaleFactor;
    let x = map(px, 0, CANVAS_WIDTH, 0, (scale * WIDTH) * 2);
    let y = map(py, 0, CANVAS_HEIGHT, 0, (scale * HEIGHT) * 2);
    return [(x - (scale * WIDTH)) - offsetX, (-(y - (scale * HEIGHT))) - offsetY];
}

function coord2canvas(px, py) {
    const scale = 1 / scaleFactor;
    let x = map((px + offsetX) + (scale * WIDTH), 0, (scale * WIDTH) * 2, 0, CANVAS_WIDTH);
    let y = map((scale * HEIGHT) - (py + offsetY), 0, (scale * HEIGHT) * 2, 0, CANVAS_HEIGHT);
    return [x, y];
}

function euclidean(p1, p2) {
    return Math.sqrt(Math.pow((p2[0] - p1[0]), 2) + Math.pow((p2[1] - p1[1]), 2))
}

function stopTouchScrolling(canvas) {
    // Prevent scrolling when touching the canvas
    document.body.addEventListener("touchstart", function (e) {
        if (e.target == canvas) {
            e.preventDefault();
        }
    }, { passive: false });
    document.body.addEventListener("touchend", function (e) {
        if (e.target == canvas) {
            e.preventDefault();
        }
    }, { passive: false });
    document.body.addEventListener("touchmove", function (e) {
        if (e.target == canvas) {
            e.preventDefault();
        }
    }, { passive: false });

}

function invertColor(color) {
    color = parseInt(color, 16);
    let r = (color >> 16) & 0xFF;
    let g = (color >> 8) & 0xFF;
    let b = color & 0xFF;

    let invertedRed = 255 - r;
    let invertedGreen = 255 - g;
    let invertedBlue = 255 - b;

    let invertedColor = `#${(1 << 24 | invertedRed << 16 | invertedGreen << 8 | invertedBlue).toString(16).slice(1)}`;

    return invertedColor;
}

function generateRandomColor(baseColor) {
    // Convert the base color string to RGB values
    let baseRGB = parseInt(baseColor, 16);
    let baseRed = (baseRGB >> 16) & 0xFF;
    let baseGreen = (baseRGB >> 8) & 0xFF;
    let baseBlue = baseRGB & 0xFF;

    // Generate random offsets for each RGB component
    let redOffset = Math.floor(Math.random() * 51) - 25;  // Random number between -25 and 25
    let greenOffset = Math.floor(Math.random() * 51) - 25;
    let blueOffset = Math.floor(Math.random() * 51) - 25;

    // Apply the offsets to the base color
    let randomRed = (baseRed + redOffset) % 256;
    let randomGreen = (baseGreen + greenOffset) % 256;
    let randomBlue = (baseBlue + blueOffset) % 256;

    // Ensure the values are within the valid range (0 to 255)
    randomRed = Math.max(0, Math.min(255, randomRed));
    randomGreen = Math.max(0, Math.min(255, randomGreen));
    randomBlue = Math.max(0, Math.min(255, randomBlue));

    // Convert the RGB values back to a hexadecimal color string
    let randomColor = `#${(1 << 24 | randomRed << 16 | randomGreen << 8 | randomBlue).toString(16).slice(1)}`;

    return randomColor;
}

const Primitives = {
    Ellipse: 0,
    Line: 1,
    Segment: 2,
    Wedge: 3
}

class Primitive {
    constructor(type, ...args) {
        this.type = type;
        this.args = args;
    }
}

class DualityCanvas {
    constructor(sketch, xDim, yDim, isPrimal) {
        this.sketch = sketch;

        this.sketch.setup = () => {
            CANVAS_HEIGHT = document.querySelector("#primal").offsetHeight;
            CANVAS_WIDTH = document.querySelector("#primal").offsetHeight;

            this.canvas = this.sketch.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);


            this.sketch.resizeCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);

            if (isPrimal) {
                this.canvas.parent('primal');
            } else {
                this.canvas.parent('dual');
            }

            this.sketch.windowResized = e => {
                CANVAS_HEIGHT = document.querySelector("#primal").offsetHeight;
                CANVAS_WIDTH = document.querySelector("#primal").offsetWidth;
    
                this.sketch.resizeCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
            }

            stopTouchScrolling(document.querySelector("#primal"));
            stopTouchScrolling(document.querySelector("#dual"));

            this.canvas.mousePressed((e) => this.onMousePressed(e));
            this.canvas.mouseMoved((e) => this.onMouseDragged(e));
            this.canvas.mouseReleased((e) => this.onMouseReleased(e));

            this.canvas.mouseWheel(e => {
                const amnt = e.deltaY * 0.001 * scaleFactor;
                scaleFactor += amnt;
                scaleFactor = Math.max(Math.min(scaleFactor, 10.0), 0.1);
                return false;
            });

            for (let element of document.getElementsByClassName("p5Canvas")) {
                element.addEventListener("contextmenu", (e) => e.preventDefault());
            }
        }

        this.sketch.draw = () => this.draw();

        this.mouseWasPressed = false;
        this.mouseDownX = 0;
        this.mouseDownY = 0;

        this.rightMouseWasPressed = false;
        this.rightDragX = 0;
        this.rightDragY = 0;

        this.isPrimal = isPrimal;

        this.objects = [];

        this.colorPickers = [];

        this.colorCount = 0;
    }

    onMousePressed(e) {
        let [x, y] = canvas2coord(this.sketch.mouseX, this.sketch.mouseY);

        switch (this.sketch.mouseButton) {
            case this.sketch.LEFT:
                if (!this.mouseWasPressed) {
                    this.mouseWasPressed = true;
                    this.mouseDownX = x;
                    this.mouseDownY = y;
                }
                break;

            case this.sketch.CENTER:
                break;

            case this.sketch.RIGHT:
                if (!this.rightMouseWasPressed) {
                    this.rightMouseWasPressed = true;
                    this.rightDragX = this.sketch.mouseX;
                    this.rightDragY = this.sketch.mouseY;
                }
                break;
        }
    }

    onMouseDragged(e) {
        if (this.rightMouseWasPressed && e.buttons === 2) {
            targetOffsetX += map(this.sketch.mouseX - this.rightDragX, 0, 700, 0, 2 * WIDTH) * (1 / scaleFactor);
            targetOffsetY += -map(this.sketch.mouseY - this.rightDragY, 0, 700, 0, 2 * HEIGHT) * (1 / scaleFactor);
            this.rightDragX = this.sketch.mouseX;
            this.rightDragY = this.sketch.mouseY;
        }
    }

    onMouseReleased(e) {
        let [x, y] = canvas2coord(this.sketch.mouseX, this.sketch.mouseY);

        switch (this.sketch.mouseButton) {
            case this.sketch.LEFT:

                if (this.mouseWasPressed) {

                    this.mouseWasPressed = false;

                    if (euclidean([x, y], [this.mouseDownX, this.mouseDownY]) > dragThreshold) {

                        if (drawSegments) {
                            this.drawPrimitive(Primitives.Segment, this.mouseDownX, this.mouseDownY, x, y);

                            if (this.isPrimal) {
                                dual.drawPrimitive(Primitives.Wedge, this.mouseDownX, this.mouseDownY, x, y);
                            } else {
                                primal.drawPrimitive(Primitives.Wedge, this.mouseDownX, this.mouseDownY, x, y);
                            }
                        } else {
                            let a = (y - this.mouseDownY) / (x - this.mouseDownX);
                            let b = 0 - (y - (a * x));

                            this.drawPrimitive(Primitives.Line, a, b);

                            if (this.isPrimal) {
                                dual.drawPrimitive(Primitives.Ellipse, a, b);
                            } else {
                                primal.drawPrimitive(Primitives.Ellipse, a, b);
                            }
                        }

                    } else {
                        // Didn't drag, draw point
                        this.drawPrimitive(Primitives.Ellipse, x, y);
                        if (this.isPrimal) {
                            dual.drawPrimitive(Primitives.Line, x, y);
                        } else {
                            primal.drawPrimitive(Primitives.Line, x, y);
                        }
                    }
                }
                break;

            case this.sketch.CENTER:
                break;

            case this.sketch.RIGHT:
                this.rightMouseWasPressed = false;
                break;
        }

    }

    drawPrimitive(type, ...args) {
        this.objects.push(new Primitive(type, ...args));

        switch (type) {
            case Primitives.Ellipse:
                {
                    const [x, y] = args;
                    this.addToList(`(${x.toFixed(3)},\xa0${y.toFixed(3)})`)
                }
                break;
            case Primitives.Line:
                {
                    const [a, b] = args;
                    this.addToList(`y\xa0=\xa0${a.toFixed(3)}x\xa0${b >= 0 ? "-" : "+"}\xa0${Math.abs(b).toFixed(3)}`)
                }
                break;
            case Primitives.Segment:
                {
                    const [x1, y1, x2, y2] = args;
                    this.addToList(`(${x1.toFixed(3)},\xa0${y1.toFixed(3)})\xa0->\n(${x2.toFixed(3)},\xa0${y2.toFixed(3)})`);
                }
                break;
            case Primitives.Wedge:
                {
                    const [x1, y1, x2, y2] = args;
                    this.addToList(`y\xa0=\xa0${x1.toFixed(3)}x\xa0${y1 >= 0 ? "-" : "+"}\xa0${Math.abs(y1).toFixed(3)}\xa0->\ny\xa0=\xa0${x2.toFixed(3)}x\xa0${y2 >= 0 ? "-" : "+"}\xa0${Math.abs(y2).toFixed(3)}`);
                }
                break;
        }

        if (this.isPrimal) {
            colors.push("#000000");
        }
    }

    addToList(text) {
        const colorPickerLi = document.createElement("li");
        colorPickerLi.className = "listItem";
        const colorPicker = document.createElement("input");
        colorPicker.setAttribute("type", "color");
        colorPicker.setAttribute("number", this.colorCount);
        colorPickerLi.appendChild(colorPicker);

        const p = document.createElement("p");
        p.appendChild(document.createTextNode(text));
        colorPickerLi.appendChild(p);

        if (this.isPrimal) {
            colorPicker.id = `primal${this.colorCount}`;
            colorPicker.addEventListener("change", (e) => {
                document.querySelector(`#dual${colorPicker.getAttribute("number")}`).value = e.target.value;
                colors[parseInt(colorPicker.getAttribute("number"))] = e.target.value;
            });
            this.colorCount++;
            document.querySelector("#primalList").appendChild(colorPickerLi);
        } else {
            colorPicker.id = `dual${this.colorCount}`;
            colorPicker.addEventListener("change", (e) => {
                document.querySelector(`#primal${colorPicker.getAttribute("number")}`).value = e.target.value;
                colors[colorPicker.getAttribute("number")] = e.target.value;
            });
            this.colorCount++;
            document.querySelector("#dualList").appendChild(colorPickerLi);
        }
    }

    drawGrid() {
        this.sketch.stroke(0);

        let x1, y1;
        let x2, y2;

        [x1, y1] = coord2canvas(-(WIDTH * 10), 0);
        [x2, y2] = coord2canvas((WIDTH * 10), 0);
        this.sketch.line(x1, y1, x2, y2);

        [x1, y1] = coord2canvas(0, -(HEIGHT * 10));
        [x2, y2] = coord2canvas(0, (HEIGHT * 10));
        this.sketch.line(x1, y1, x2, y2);


        for (let i = -(WIDTH * 10); i < (WIDTH * 10); i++) {
            [x1, y1] = coord2canvas(i, -0.1);
            [x2, y2] = coord2canvas(i, 0.1);
            this.sketch.line(x1, y1, x2, y2);
        }

        for (let i = -(HEIGHT * 10); i < (HEIGHT * 10); i++) {
            [x1, y1] = coord2canvas(-0.1, i);
            [x2, y2] = coord2canvas(0.1, i);
            this.sketch.line(x1, y1, x2, y2);
        }
    }

    draw() {
        this.sketch.clear();
        this.sketch.strokeWeight(3);

        this.drawGrid();

        this.sketch.stroke(0);
        this.sketch.fill(0);
        for (let i = 0; i < this.objects.length; i++) {
            this.sketch.stroke(colors[i]);
            this.sketch.fill(colors[i]);

            let p = this.objects[i];

            if (p.type === Primitives.Ellipse) {

                let [coordX, coordY] = p.args;
                let [x, y] = coord2canvas(coordX, coordY);

                this.sketch.ellipse(x, y, 10, 10);

            } else if (p.type === Primitives.Segment) {

                let [x1, y1, x2, y2] = p.args;

                let p1 = coord2canvas(x1, y1);
                let p2 = coord2canvas(x2, y2);

                this.sketch.line(p1[0], p1[1], p2[0], p2[1]);

            } else if (p.type === Primitives.Line) {

                let [a, b] = p.args;

                let p1 = [(-(WIDTH * 10) + b) / a, -(WIDTH * 10)];
                let p2 = [((WIDTH * 10) + b) / a, (WIDTH * 10)];

                let p1Canvas = coord2canvas(p1[0], p1[1]);
                let p2Canvas = coord2canvas(p2[0], p2[1]);

                this.sketch.line(p1Canvas[0], p1Canvas[1], p2Canvas[0], p2Canvas[1]);

            } else if (p.type === Primitives.Wedge) {

                let [a1, b1, a2, b2] = p.args;

                let bLine1 = coord2canvas((-(WIDTH * 10) + b1) / a1, -(WIDTH * 10));
                let tLine1 = coord2canvas(((WIDTH * 10) + b1) / a1, (WIDTH * 10));

                let bLine2 = coord2canvas((-(WIDTH * 10) + b2) / a2, -(WIDTH * 10));
                let tLine2 = coord2canvas(((WIDTH * 10) + b2) / a2, (WIDTH * 10));

                this.sketch.line(bLine1[0], bLine1[1], tLine1[0], tLine1[1]);
                this.sketch.line(bLine2[0], bLine2[1], tLine2[0], tLine2[1]);

                let intersection = [(b2 - b1) / (a2 - a1), a1 * ((b2 - b1) / (a2 - a1)) - b1];
                let intersection_canvas = coord2canvas(...intersection);

                this.sketch.fill(colors[i] + "22");
                this.sketch.stroke(0, 0, 0, 0);

                if ((a1 < 0 && a2 > 0) || (a2 < 0 && a1 > 0)) {
                    this.sketch.beginShape();
                    this.sketch.vertex(...bLine1);
                    this.sketch.vertex(...tLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();

                    this.sketch.beginShape();
                    this.sketch.vertex(...tLine1);
                    this.sketch.vertex(...bLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();
                } else {
                    this.sketch.beginShape();
                    this.sketch.vertex(...tLine1);
                    this.sketch.vertex(...tLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();

                    this.sketch.beginShape();
                    this.sketch.vertex(...bLine1);
                    this.sketch.vertex(...bLine2);
                    this.sketch.vertex(...intersection_canvas);
                    this.sketch.endShape();
                }
                this.sketch.stroke(0);
            }
        }
        offsetX = this.sketch.lerp(offsetX, targetOffsetX, 0.1);
        offsetY = this.sketch.lerp(offsetY, targetOffsetY, 0.1);
    }
}

// Reference https://editor.p5js.org/caminofarol/sketches/r609C2cs
const primalConstructor = (sketch) => {
    primal = new DualityCanvas(sketch, CANVAS_WIDTH, CANVAS_HEIGHT, true);
}

const dualConstructor = (sketch) => {
    dual = new DualityCanvas(sketch, CANVAS_WIDTH, CANVAS_HEIGHT, false);
}

new p5(primalConstructor);
new p5(dualConstructor);