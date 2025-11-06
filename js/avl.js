const canvas = document.getElementById('avlCanvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('statusText');

function lerp(a, b, t) { return a + (b - a) * t; }

class AVLNode {
	constructor(value) {
		this.value = value;
		this.left = null;
		this.right = null;
		this.height = 1;
		this.x = canvas.width / 2;
		this.y = 50;
		this.targetX = this.x;
		this.targetY = this.y;
		this.arcPath = null;
		this.arcProgress = 0;
	}
}

class AVLTree {
	constructor() {
		this.root = null;
		this.animationSpeed = 0.05;
		this.operationQueue = [];
		this.traversingNodes = null;
		this.traversingProgress = 0;
		this.isProcessing = false;
		requestAnimationFrame(() => this.animate());
	}

	// ✅ Speed control slider mapping
	setAnimationSpeedFromSlider(sliderValue) {
		const min = 100, max = 2000;
		const minAnim = 0.005;
		const maxAnim = 0.2;
		const ratio = (sliderValue - min) / (max - min);
		const mapped = minAnim + ratio * (maxAnim - minAnim);
		this.animationSpeed = Math.max(minAnim, Math.min(maxAnim, mapped));
	}

	getHeight(node) { return node ? node.height : 0; }
	getBalance(node) { return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0; }
	minValueNode(node) { while (node.left) node = node.left; return node; }

	// --- ROTATIONS ---
	rotateRight(y) {
		const x = y.left;
		const T2 = x.right;

		statusText.textContent = `Rotating Right at node ${y.value}`;

		x.right = y;
		y.left = T2;

		y.height = 1 + Math.max(this.getHeight(y.left), this.getHeight(y.right));
		x.height = 1 + Math.max(this.getHeight(x.left), this.getHeight(x.right));

		this.setupArcRotation(y, x, false);
		this.clearStatusAfterDelay();
		return x;
	}

	rotateLeft(x) {
		const y = x.right;
		const T2 = y.left;

		statusText.textContent = `Rotating Left at node ${x.value}`;

		y.left = x;
		x.right = T2;

		x.height = 1 + Math.max(this.getHeight(x.left), this.getHeight(x.right));
		y.height = 1 + Math.max(this.getHeight(y.left), this.getHeight(y.right));

		this.setupArcRotation(x, y, true);
		this.clearStatusAfterDelay();
		return y;
	}

	setupArcRotation(nodeA, nodeB, clockwise) {
		nodeA.arcPath = this.computeArcPath(nodeA, nodeB, clockwise);
		nodeB.arcPath = this.computeArcPath(nodeB, nodeB, clockwise);
		nodeA.arcProgress = 0;
		nodeB.arcProgress = 0;
	}

	computeArcPath(node, pivot, clockwise) {
		const dx = node.x - pivot.x;
		const dy = node.y - pivot.y;
		const radius = Math.sqrt(dx * dx + dy * dy);
		const startAngle = Math.atan2(dy, dx);
		const endAngle = Math.atan2(node.targetY - pivot.y, node.targetX - pivot.x);
		return { pivotX: pivot.x, pivotY: pivot.y, radius, startAngle, endAngle, clockwise };
	}

	animateArc(node) {
		const p = node.arcPath;
		let t = node.arcProgress;
		if (p.clockwise) {
			node.x = p.pivotX + p.radius * Math.cos(p.startAngle + (p.endAngle - p.startAngle) * t);
			node.y = p.pivotY + p.radius * Math.sin(p.startAngle + (p.endAngle - p.startAngle) * t);
		} else {
			node.x = p.pivotX + p.radius * Math.cos(p.startAngle - (p.startAngle - p.endAngle) * t);
			node.y = p.pivotY + p.radius * Math.sin(p.startAngle - (p.startAngle - p.endAngle) * t);
		}
		node.arcProgress += this.animationSpeed;
		if (node.arcProgress >= 1) node.arcPath = null;
	}

	// --- INSERT / DELETE ---
	insert(node, value) {
		if (!node) return new AVLNode(value);
		if (value < node.value) node.left = this.insert(node.left, value);
		else if (value > node.value) node.right = this.insert(node.right, value);
		else {
			alert(`Value ${value} already exists in the tree.`);
			return node;
		}

		node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
		const balance = this.getBalance(node);

		if (balance > 1 && value < node.left.value) return this.rotateRight(node);
		if (balance < -1 && value > node.right.value) return this.rotateLeft(node);
		if (balance > 1 && value > node.left.value) {
			node.left = this.rotateLeft(node.left);
			return this.rotateRight(node);
		}
		if (balance < -1 && value < node.right.value) {
			node.right = this.rotateRight(node.right);
			return this.rotateLeft(node);
		}
		return node;
	}

	deleteNode(node, value) {
		if (!node) {
			alert(`Value ${value} not found in the tree.`);
			return node;
		}

		if (value < node.value) node.left = this.deleteNode(node.left, value);
		else if (value > node.value) node.right = this.deleteNode(node.right, value);
		else {
			if (!node.left || !node.right) node = node.left || node.right || null;
			else {
				const temp = this.minValueNode(node.right);
				node.value = temp.value;
				node.right = this.deleteNode(node.right, temp.value);
			}
		}

		if (!node) return node;

		node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
		const balance = this.getBalance(node);

		if (balance > 1 && this.getBalance(node.left) >= 0) return this.rotateRight(node);
		if (balance > 1 && this.getBalance(node.left) < 0) {
			node.left = this.rotateLeft(node.left);
			return this.rotateRight(node);
		}
		if (balance < -1 && this.getBalance(node.right) <= 0) return this.rotateLeft(node);
		if (balance < -1 && this.getBalance(node.right) > 0) {
			node.right = this.rotateRight(node.right);
			return this.rotateLeft(node);
		}
		return node;
	}

	// --- OPERATION QUEUE ---
	enqueueOperation(type, value) {
		if (this.isProcessing) return;
		this.isProcessing = true;
		disableAll(true);

		let path = [];
		let node = this.root;
		while (node) {
			path.push(node);
			if (type === "insert" || type === "delete") {
				if (value < node.value) node = node.left;
				else if (value > node.value) node = node.right;
				else break;
			} else if (type === "search") {
				if (value === node.value) break;
				node = value < node.value ? node.left : node.right;
			}
		}
		this.operationQueue.push({ type, value, path, progress: 0 });
		statusText.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)}ing ${value}...`;
	}

	processOperations() {
		if (this.operationQueue.length === 0) return;
		const op = this.operationQueue[0];
		op.progress += 0.05;
		this.traversingNodes = op.path;
		this.traversingProgress = op.progress;

		let index = Math.floor(op.progress);
		if (op.path && index < op.path.length) {
			statusText.textContent = `${op.type.charAt(0).toUpperCase() + op.type.slice(1)}ing ${op.value}: visiting node ${op.path[index].value}`;
		}

		if (Math.floor(op.progress) >= op.path.length) {
			if (op.type === "insert") this.root = this.insert(this.root, op.value);
			else if (op.type === "delete") this.root = this.deleteNode(this.root, op.value);
			else if (op.type === "search") {
				const found = op.path.length > 0 && op.path[op.path.length - 1].value === op.value;
				statusText.textContent = found ? `Found ${op.value}` : `${op.value} not found`;
			}
			this.updateTargets();
			this.operationQueue.shift();
			this.traversingNodes = null;
			this.traversingProgress = 0;
			this.clearStatusAfterDelay();
		}
	}

	clearStatusAfterDelay() {
		clearTimeout(this.clearTimeout);
		this.clearTimeout = setTimeout(() => { statusText.textContent = ""; }, 2000);
	}

	updateTargets() {
		const assignPos = (node, x, y, spacing) => {
			if (!node) return;
			node.targetX = x;
			node.targetY = y;
			assignPos(node.left, x - spacing, y + 80, spacing / 2);
			assignPos(node.right, x + spacing, y + 80, spacing / 2);
		};
		assignPos(this.root, canvas.width / 2, 50, 200);
	}

	animateNode(node) {
		if (!node) return false;
		let moved = false;
		if (node.arcPath) { this.animateArc(node); moved = true; }
		else {
			const dx = node.targetX - node.x;
			const dy = node.targetY - node.y;
			if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
				node.x += dx * this.animationSpeed;
				node.y += dy * this.animationSpeed;
				moved = true;
			}
		}
		const leftMoved = this.animateNode(node.left);
		const rightMoved = this.animateNode(node.right);
		return moved || leftMoved || rightMoved;
	}

	drawNode(node) {
		if (!node) return;
		if (node.left) {
			ctx.beginPath();
			ctx.moveTo(node.x, node.y + 20);
			ctx.lineTo(node.left.x, node.left.y - 20);
			ctx.stroke();
			this.drawNode(node.left);
		}
		if (node.right) {
			ctx.beginPath();
			ctx.moveTo(node.x, node.y + 20);
			ctx.lineTo(node.right.x, node.right.y - 20);
			ctx.stroke();
			this.drawNode(node.right);
		}

		ctx.beginPath();
		ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
		ctx.fillStyle = 'skyblue';
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = 'black';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(node.value, node.x, node.y);
	}

	animate() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		this.processOperations();
		const isMoving = this.root ? this.animateNode(this.root) : false;
		if (this.root) this.drawNode(this.root);

		// Red traversal ring
		if (this.traversingNodes && this.traversingNodes.length > 0) {
			let index = Math.floor(this.traversingProgress);
			let node = this.traversingNodes[Math.min(index, this.traversingNodes.length - 1)];
			ctx.beginPath();
			ctx.arc(node.x, node.y, 28, 0, Math.PI * 2);
			ctx.strokeStyle = 'red';
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 1;
		}

		// ✅ re-enable buttons/input only when motion ends
		if (!isMoving && this.isProcessing && this.operationQueue.length === 0) {
			this.isProcessing = false;
			disableAll(false);
		}

		requestAnimationFrame(() => this.animate());
	}
}

// --- Helpers ---
function disableAll(disabled) {
	document.getElementById('insertBtn').disabled = disabled;
	document.getElementById('deleteBtn').disabled = disabled;
	document.getElementById('searchBtn').disabled = disabled;
	document.getElementById('valueInput').disabled = disabled;
}

const tree = new AVLTree();
const speedSlider = document.getElementById('speedSlider');
tree.setAnimationSpeedFromSlider(parseInt(speedSlider.value));
speedSlider.addEventListener('input', () => {
	tree.setAnimationSpeedFromSlider(parseInt(speedSlider.value));
});

const input = document.getElementById('valueInput');

document.getElementById('insertBtn').addEventListener('click', () => {
	const val = parseInt(input.value);
	if (!isNaN(val)) tree.enqueueOperation("insert", val);
	input.value = "";
});
document.getElementById('deleteBtn').addEventListener('click', () => {
	const val = parseInt(input.value);
	if (!isNaN(val)) tree.enqueueOperation("delete", val);
	input.value = "";
});
document.getElementById('searchBtn').addEventListener('click', () => {
	const val = parseInt(input.value);
	if (!isNaN(val)) tree.enqueueOperation("search", val);
	input.value = "";
});

// ✅ Press Enter to Insert (disabled during animation)
input.addEventListener('keypress', (e) => {
	if (e.key === 'Enter' && !tree.isProcessing) {
		const val = parseInt(input.value);
		if (!isNaN(val)) tree.enqueueOperation("insert", val);
		input.value = "";
	}
});
