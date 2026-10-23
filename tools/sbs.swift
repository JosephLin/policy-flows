// Composes a before/after pair side by side under a title, for docs/milestones/.
// Usage: swift tools/sbs.swift <before.png|-> <after.png> <out.png> "<title>"
// Pass "-" as before for a milestone with nothing to compare against.
import AppKit

let args = CommandLine.arguments
guard args.count == 5 else {
  FileHandle.standardError.write("usage: sbs.swift <before|-> <after> <out> <title>\n".data(using: .utf8)!)
  exit(1)
}
func load(_ path: String) -> CGImage? {
  guard path != "-", let img = NSImage(contentsOfFile: path) else { return nil }
  return img.cgImage(forProposedRect: nil, context: nil, hints: nil)
}
let before = load(args[1])
guard let after = load(args[2]) else { fatalError("cannot read \(args[2])") }

let w = after.width, h = after.height, gap = 24, pad = 32, titleH = 72, labelH = 44
let cols = before == nil ? 1 : 2
let W = pad * 2 + cols * w + (cols - 1) * gap, H = pad + titleH + labelH + h + pad
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8, samplesPerPixel: 4,
                           hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ink = NSColor(red: 0.13, green: 0.12, blue: 0.11, alpha: 1), muted = NSColor(red: 0.44, green: 0.41, blue: 0.38, alpha: 1)
NSColor(red: 0.98, green: 0.97, blue: 0.95, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: W, height: H).fill()
// AppKit's origin is bottom-left, so y counts up from the bottom edge.
func text(_ s: String, _ x: Int, _ yTop: Int, _ size: CGFloat, _ color: NSColor, _ weight: NSFont.Weight) {
  let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: size, weight: weight), .foregroundColor: color]
  let str = NSAttributedString(string: s, attributes: attrs)
  str.draw(at: NSPoint(x: x, y: H - yTop - Int(str.size().height)))
}
text(args[4], pad, pad, 30, ink, .semibold)
for (i, (label, img)) in [("Before", before), ("After", after)].filter({ $0.1 != nil }).enumerated() {
  let x = pad + i * (w + gap)
  text(label, x, pad + titleH, 20, muted, .medium)
  NSGraphicsContext.current!.cgContext.draw(img!, in: CGRect(x: x, y: pad, width: w, height: h))
}
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[3]))
print(args[3])
