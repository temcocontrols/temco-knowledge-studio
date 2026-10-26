// The annotation surface for a screenshot, before it becomes an attachment.
//
// Every tool is one drag. The operations are kept as a list and replayed onto a copy of the base image, which is what
// makes Undo cheap and what makes the result reproducible — the exported PNG has them baked in, so nothing downstream
// has to understand them and a reader cannot remove them.
//
// Blur is offered because people reach for it, but Redact is the one that removes pixels: a blurred key is still a
// published key. The banner says so rather than leaving it to the documentation.

import * as React from 'react';
import {
	Button,
	Dialog,
	DialogActions,
	DialogBody,
	DialogContent,
	DialogSurface,
	DialogTitle,
	Input,
	MessageBar,
	MessageBarBody,
} from '@fluentui/react-components';

type Tool = 'arrow' | 'rect' | 'ellipse' | 'callout' | 'redact' | 'blur' | 'step' | 'crop';

interface Op {
	kind: Exclude<Tool, 'crop'>;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	n?: number;
}

interface Snapshot {
	imageData: ImageData;
	width: number;
	height: number;
	ops: Op[];
}

const TOOLS: ReadonlyArray<{ id: Tool; label: string }> = [
	{ id: 'arrow', label: 'Arrow' },
	{ id: 'rect', label: 'Box' },
	{ id: 'ellipse', label: 'Ellipse' },
	{ id: 'callout', label: 'Callout' },
	{ id: 'redact', label: 'Redact' },
	{ id: 'blur', label: 'Blur' },
	{ id: 'step', label: 'Step' },
	{ id: 'crop', label: 'Crop' },
];

export interface AnnotateProps {
	open: boolean;
	src: string | undefined;
	caption: string;
	onClose: () => void;
	onInsert: (png: string, caption: string, stepCount: number) => void;
}

export function AnnotateDialog(props: AnnotateProps): React.ReactElement {
	const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
	const baseRef = React.useRef<ImageData | null>(null);
	const opsRef = React.useRef<Op[]>([]);
	const cropsRef = React.useRef<Snapshot[]>([]);
	const dragRef = React.useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
	const [tool, setTool] = React.useState<Tool>('arrow');
	const [caption, setCaption] = React.useState(props.caption);
	const [step, setStep] = React.useState(1);
	const [ready, setReady] = React.useState(false);

	const drawOp = React.useCallback((context: CanvasRenderingContext2D, op: Op): void => {
		context.save();
		const unit = Math.max(2, Math.round(context.canvas.width / 400));
		context.lineWidth = unit;
		context.strokeStyle = '#ff3b30';
		context.fillStyle = 'rgba(255, 59, 48, 0.16)';
		const x = Math.min(op.x1, op.x2);
		const y = Math.min(op.y1, op.y2);
		const width = Math.abs(op.x2 - op.x1);
		const height = Math.abs(op.y2 - op.y1);

		switch (op.kind) {
			case 'arrow': {
				context.beginPath();
				context.moveTo(op.x1, op.y1);
				context.lineTo(op.x2, op.y2);
				context.stroke();
				const angle = Math.atan2(op.y2 - op.y1, op.x2 - op.x1);
				const head = 12 + unit * 2;
				context.beginPath();
				context.moveTo(op.x2, op.y2);
				context.lineTo(op.x2 - head * Math.cos(angle - 0.4), op.y2 - head * Math.sin(angle - 0.4));
				context.lineTo(op.x2 - head * Math.cos(angle + 0.4), op.y2 - head * Math.sin(angle + 0.4));
				context.closePath();
				context.fillStyle = '#ff3b30';
				context.fill();
				break;
			}
			case 'rect': {
				context.fillRect(x, y, width, height);
				context.strokeRect(x, y, width, height);
				break;
			}
			case 'ellipse': {
				context.beginPath();
				context.ellipse(x + width / 2, y + height / 2, Math.max(2, width / 2), Math.max(2, height / 2), 0, 0, Math.PI * 2);
				context.fill();
				context.stroke();
				break;
			}
			case 'redact': {
				context.fillStyle = '#111111';
				context.fillRect(x, y, width, height);
				context.strokeRect(x, y, width, height);
				break;
			}
			case 'blur': {
				context.beginPath();
				context.rect(x, y, width, height);
				context.clip();
				context.filter = 'blur(9px)';
				context.drawImage(context.canvas, 0, 0);
				context.filter = 'none';
				break;
			}
			case 'callout': {
				const zoom = 2.2;
				const insetWidth = Math.min(context.canvas.width * 0.42, width * zoom);
				const insetHeight = Math.max(24, insetWidth * (height / Math.max(1, width)));
				let targetX = x + width + 18 + insetWidth <= context.canvas.width ? x + width + 18 : x - 18 - insetWidth;
				if (targetX < 6) {
					targetX = Math.max(6, context.canvas.width - insetWidth - 6);
				}
				const targetY = Math.min(Math.max(6, y), Math.max(6, context.canvas.height - insetHeight - 6));
				context.lineWidth = Math.max(1, unit - 1);
				context.beginPath();
				context.moveTo(x + width, y);
				context.lineTo(targetX, targetY);
				context.moveTo(x + width, y + height);
				context.lineTo(targetX, targetY + insetHeight);
				context.stroke();
				context.drawImage(context.canvas, x, y, width, height, targetX, targetY, insetWidth, insetHeight);
				context.lineWidth = unit;
				context.strokeRect(targetX, targetY, insetWidth, insetHeight);
				break;
			}
			case 'step': {
				const radius = 15 + unit;
				context.beginPath();
				context.arc(op.x1, op.y1, radius, 0, Math.PI * 2);
				context.fillStyle = '#ff3b30';
				context.fill();
				context.fillStyle = '#ffffff';
				context.font = `bold ${Math.round(radius)}px Segoe UI, sans-serif`;
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillText(String(op.n ?? 1), op.x1, op.y1 + 1);
				break;
			}
		}
		context.restore();
	}, []);

	const redraw = React.useCallback((preview?: Op): void => {
		const canvas = canvasRef.current;
		const base = baseRef.current;
		if (canvas === null || base === null) {
			return;
		}
		const context = canvas.getContext('2d');
		if (context === null) {
			return;
		}
		context.putImageData(base, 0, 0);
		for (const op of opsRef.current) {
			drawOp(context, op);
		}
		if (preview !== undefined) {
			drawOp(context, preview);
		}
	}, [drawOp]);

	React.useEffect(() => {
		if (!props.open || props.src === undefined) {
			return;
		}
		opsRef.current = [];
		cropsRef.current = [];
		dragRef.current = null;
		setReady(false);
		setCaption(props.caption);
		setStep(1);

		const image = new Image();
		image.onload = () => {
			requestAnimationFrame(() => {
				const canvas = canvasRef.current;
				if (canvas === null) {
					return;
				}
				const scale = Math.min(1, 960 / image.width);
				canvas.width = Math.round(image.width * scale);
				canvas.height = Math.round(image.height * scale);
				const context = canvas.getContext('2d');
				if (context === null) {
					return;
				}
				context.fillStyle = '#ffffff';
				context.fillRect(0, 0, canvas.width, canvas.height);
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				baseRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
				setReady(true);
			});
		};
		image.onerror = () => props.onClose();
		image.src = props.src;
	}, [props.open, props.src]);

	const pointOf = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
		const canvas = event.currentTarget;
		const rect = canvas.getBoundingClientRect();
		return {
			x: (event.clientX - rect.left) * (canvas.width / rect.width),
			y: (event.clientY - rect.top) * (canvas.height / rect.height),
		};
	};

	const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
		if (!ready) {
			return;
		}
		const point = pointOf(event);
		if (tool === 'step') {
			opsRef.current.push({ kind: 'step', x1: point.x, y1: point.y, x2: point.x, y2: point.y, n: step });
			setStep(step + 1);
			redraw();
			return;
		}
		dragRef.current = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
		const drag = dragRef.current;
		if (drag === null) {
			return;
		}
		const point = pointOf(event);
		drag.x2 = point.x;
		drag.y2 = point.y;
		if (tool !== 'crop') {
			redraw({ kind: tool, ...drag });
		}
	};

	const onPointerUp = (): void => {
		const drag = dragRef.current;
		dragRef.current = null;
		if (drag === null) {
			return;
		}
		const width = Math.abs(drag.x2 - drag.x1);
		const height = Math.abs(drag.y2 - drag.y1);
		if (width < 4 && height < 4) {
			redraw();
			return;
		}

		if (tool === 'crop') {
			if (width < 24 || height < 24) {
				redraw();
				return;
			}
			const canvas = canvasRef.current;
			const context = canvas?.getContext('2d') ?? null;
			if (canvas === null || context === null || baseRef.current === null) {
				return;
			}
			cropsRef.current.push({
				imageData: context.getImageData(0, 0, canvas.width, canvas.height),
				width: canvas.width,
				height: canvas.height,
				ops: opsRef.current.slice(),
			});
			const temporary = document.createElement('canvas');
			temporary.width = Math.round(width);
			temporary.height = Math.round(height);
			temporary
				.getContext('2d')
				?.drawImage(canvas, Math.round(Math.min(drag.x1, drag.x2)), Math.round(Math.min(drag.y1, drag.y2)), temporary.width, temporary.height, 0, 0, temporary.width, temporary.height);
			canvas.width = temporary.width;
			canvas.height = temporary.height;
			context.drawImage(temporary, 0, 0);
			baseRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
			opsRef.current = [];
			return;
		}

		opsRef.current.push({ kind: tool, x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2 });
		redraw();
	};

	const undo = (): void => {
		if (opsRef.current.length > 0) {
			opsRef.current.pop();
			redraw();
			return;
		}
		const snapshot = cropsRef.current.pop();
		const canvas = canvasRef.current;
		if (snapshot === undefined || canvas === null) {
			return;
		}
		canvas.width = snapshot.width;
		canvas.height = snapshot.height;
		const context = canvas.getContext('2d');
		if (context === null) {
			return;
		}
		context.putImageData(snapshot.imageData, 0, 0);
		baseRef.current = snapshot.imageData;
		opsRef.current = snapshot.ops;
	};

	return (
		<Dialog open={props.open} onOpenChange={(_event, data) => { if (!data.open) { props.onClose(); } }}>
			<DialogSurface style={{ maxWidth: '1060px', width: '92vw' }}>
				<DialogBody>
					<DialogTitle>Annotate screenshot</DialogTitle>
					<DialogContent>
						<div className="anno">
							<div className="anno__tools">
								{TOOLS.map((item) => (
									<Button
										key={item.id}
										size="small"
										appearance={tool === item.id ? 'primary' : 'secondary'}
										data-tool={item.id}
										onClick={() => setTool(item.id)}
									>
										{item.label}
									</Button>
								))}
								<Button size="small" onClick={undo}>Undo</Button>
								<Button size="small" onClick={() => { opsRef.current = []; cropsRef.current = []; setStep(1); redraw(); }}>Clear</Button>
							</div>
							{tool === 'blur'
								? (
									<MessageBar intent="warning">
										<MessageBarBody>
											Blur is a convenience. If those pixels must not leave the company, use <strong>Redact</strong> — a
											blurred key is still a published key.
										</MessageBarBody>
									</MessageBar>
								)
								: null}
							<div className="anno__canvas">
								<canvas
									ref={canvasRef}
									onPointerDown={onPointerDown}
									onPointerMove={onPointerMove}
									onPointerUp={onPointerUp}
									onPointerCancel={onPointerUp}
								/>
							</div>
							<Input
								placeholder="What this shows — becomes the alt text"
								value={caption}
								onChange={(_event, data) => setCaption(data.value)}
								data-anno-caption=""
							/>
						</div>
					</DialogContent>
					<DialogActions>
						<Button appearance="secondary" onClick={props.onClose}>Cancel</Button>
						<Button
							appearance="primary"
							disabled={!ready}
							data-anno-insert=""
							onClick={() => {
								const canvas = canvasRef.current;
								if (canvas !== null) {
									props.onInsert(canvas.toDataURL('image/png'), caption.trim(), step - 1);
								}
							}}
						>
							Insert into document
						</Button>
					</DialogActions>
				</DialogBody>
			</DialogSurface>
		</Dialog>
	);
}
