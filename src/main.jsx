import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as pdfjsLib from 'pdfjs-dist'
import { CalendarDays, ChevronDown, ChevronRight, CircleHelp, FileUp, Info, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import './styles.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const initialItems = [{ id: 1, name: '', size: '', color: '', print: '', category: '', weight: '', unit: '', mrp: '' }]
const attributes = ['Select Attribute', 'Small', 'Medium', 'Large']
const customers = ['Select Customer', 'Aarav Textiles Pvt. Ltd.', 'Nirmal Retailers', 'Shree Garments']
const menuItems = ['Sale', 'Purchase', 'Items', 'Party', 'Accounts', 'Reports', 'Setup']
const moduleTabs = ['Bills', 'Customers', 'Items', 'Inventory', 'Reports', 'Settings']

function Select({ children, className = '', ...props }) {
  return <div className={`select-wrap ${className}`}><select {...props}>{children}</select><ChevronDown size={13} /></div>
}
function Field({ label, children, className = '', required = false }) {
  return <label className={`field ${className}`}><span>{label}{required && <b>*</b>}</span>{children}</label>
}
function Section({ title, shortcut, open, onToggle, children, className = '' }) {
  return <section className={`panel section-panel ${className}`}>
    <button className="section-title" onClick={onToggle} type="button"><span>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{title}{shortcut && <em>{shortcut}</em>}</span></button>
    {open && <div className="section-content">{children}</div>}
  </section>
}
function MiniButton({ children, onClick, title }) { return <button className="mini-add" type="button" onClick={onClick} title={title}><Plus size={13} />{children}</button> }

function App() {
  const [items, setItems] = useState(initialItems)
  const [charges, setCharges] = useState([{ id: 1 }])
  const [terms, setTerms] = useState([{ id: 1 }])
  const [open, setOpen] = useState({ charges: false, transport: true, referral: true, terms: true, payment: false })
  const [customer, setCustomer] = useState('Select Customer')
  const [invoiceNo, setInvoiceNo] = useState('SB-2026-0001')
  const [invoiceDate, setInvoiceDate] = useState('2026-09-23')
  const [dueDate, setDueDate] = useState('2026-09-23')
  const [saved, setSaved] = useState(false)
  const [imported, setImported] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [source, setSource] = useState('manual')
  const [ocrFlags, setOcrFlags] = useState({})
  const fileRef = useRef(null)

  useEffect(() => {
    const keyHandler = (event) => {
      if (event.key === 'F9') { event.preventDefault(); addItem() }
      if (event.key === 'F8') { event.preventDefault(); toggle('charges') }
      if (event.key === 'F7') { event.preventDefault(); toggle('payment') }
    }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
  })
  const toggle = (name) => setOpen((current) => ({ ...current, [name]: !current[name] }))
  const addItem = () => setItems((current) => [...current, { id: Date.now(), name: '', size: '', color: '', print: '', category: '', weight: '', unit: '', mrp: '' }])
  const updateItem = (id, key, value) => setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item))
  const addCharge = () => setCharges((current) => [...current, { id: Date.now() }])
  const addTerm = () => setTerms((current) => [...current, { id: Date.now() }])

  const extractPdfText = async (file) => {
    const fileBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise
    let extractedText = ''

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i)
      const pageText = await page.getTextContent()
      const pageStrings = pageText.items.map((item) => item.str).join(' ')
      extractedText += `\n${pageStrings}`
    }

    return extractedText
  }

  const normalizeText = (text = '') => text.replace(/\s+/g, ' ').trim()

  const extractInvoiceFromText = (rawText) => {
    const text = normalizeText(rawText)
    const lower = text.toLowerCase()

    const invoiceNo = (() => {
      const patterns = [
        /(?:invoice\s*(?:no|number)|bill\s*(?:no|number)|inv\s*(?:no|number))\s*[:#-]?\s*([A-Z0-9\-/]+)/i,
        /(?:invoice\s*(?:no|number)|bill\s*(?:no|number)|inv\s*(?:no|number))\s*[:#-]?\s*([A-Za-z0-9\-/]+)/i,
      ]
      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match?.[1]) return match[1].trim()
      }
      return 'INV-IMPORT'
    })()

    const invoiceDate = (() => {
      const match = text.match(/(?:invoice\s*date|date)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i)
      if (match?.[1]) return match[1]
      return '2026-09-23'
    })()

    const customer = (() => {
      const labelMatch = text.match(/(?:customer|buyer|party|m\/s|name)\s*[:\-]?\s*([A-Z][A-Za-z0-9&.()\- ,/]{2,80})/i)
      if (labelMatch?.[1]) return labelMatch[1].trim()

      const fallback = text.match(/([A-Z][A-Za-z0-9&.()\- ,/]{6,80})\s*(?:\n|$)/)
      return fallback?.[1]?.trim() || 'Imported Customer'
    })()

    const firstItemName = (() => {
      const lines = rawText.split(/\n|\r/).map((line) => line.trim()).filter(Boolean)
      const itemLine = lines.find((line) => /\d+\s+[A-Za-z0-9]/.test(line) && /pcs|kg|qty|unit|item/i.test(line))
      return itemLine ? itemLine.replace(/\d+\s*/, '').replace(/\s+(?:pcs|kg|qty|unit).*$/i, '').trim() : 'Imported Item'
    })()

    const eway = /eway|e-way/i.test(lower) ? text.match(/(?:eway|e-way)\s*[:#-]?\s*([A-Z0-9-]+)/i)?.[1] || 'EWAY-IMPORT' : 'EWAY-IMPORT'

    return {
      source: 'imported',
      customer,
      invoiceNo,
      invoiceDate,
      dueDate: invoiceDate,
      items: [
        {
          id: Date.now(),
          name: firstItemName,
          size: 'Medium',
          color: 'Blue',
          print: 'Plain',
          category: 'Imported',
          weight: '0.50',
          unit: 'PCS',
          mrp: '0.00'
        }
      ],
      eway,
      flags: {
        customer: customer === 'Imported Customer',
        invoiceNo: invoiceNo === 'INV-IMPORT',
        invoiceDate: invoiceDate === '2026-09-23',
        items: firstItemName === 'Imported Item',
        eway: eway === 'EWAY-IMPORT'
      }
    }
  }

  const importInvoice = async (event) => {
    if (!event.target.files?.length) return

    const file = event.target.files[0]
    let importedBill = null

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const text = await extractPdfText(file)
        importedBill = extractInvoiceFromText(text)
      } else {
        const fileText = await file.text()
        importedBill = extractInvoiceFromText(fileText)
      }
    } catch (error) {
      console.error('Invoice import failed:', error)
      importedBill = {
        source: 'imported',
        customer: 'Imported Customer',
        invoiceNo: 'IMPORT-FAILED',
        invoiceDate: '2026-09-23',
        dueDate: '2026-09-23',
        items: [{ id: Date.now(), name: 'Imported Item', size: 'Medium', color: 'Blue', print: 'Plain', category: 'Imported', weight: '0.50', unit: 'PCS', mrp: '0.00' }],
        eway: 'EWAY-IMPORT',
        flags: {
          customer: true,
          invoiceNo: true,
          invoiceDate: true,
          items: true,
          eway: true
        }
      }
    }

    setImported(true)
    setSource(importedBill.source)
    setAttachment(file.name)
    setCustomer(importedBill.customer)
    setInvoiceNo(importedBill.invoiceNo)
    setInvoiceDate(importedBill.invoiceDate)
    setDueDate(importedBill.dueDate)
    setItems(importedBill.items)
    setOcrFlags(importedBill.flags)
  }
  const save = () => { setSaved(true); setSource('manual'); window.setTimeout(() => setSaved(false), 2200) }
  const closeForm = () => {
    if (window.confirm('Close this sale bill form? Unsaved changes will be lost.')) window.history.back()
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark">S</span><div><strong>SALE</strong><small>ERP</small></div></div>
      <nav className="side-menu" aria-label="Main menu">
        {menuItems.map((item) => (
          <button key={item} type="button" className={item === 'Sale' ? 'menu-item active' : 'menu-item'}>
            <span>{item}</span>
          </button>
        ))}
      </nav>
    </aside>
    <div className="content-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>SALE BILL</span><small>Creation</small></div>
        <div className="top-actions"><button className="import-btn" type="button" onClick={() => fileRef.current?.click()}><FileUp size={15} /> Import Invoice</button><input ref={fileRef} type="file" accept=".pdf,image/*" hidden onChange={importInvoice} /><button className="icon-button" title="Help"><CircleHelp size={17} /></button><span className="user-chip">AD</span></div>
      </header>
      <nav className="module-nav" aria-label="Module tabs">
        {moduleTabs.map((tab, index) => (
          <button key={tab} type="button" className={index === 0 ? 'module-tab active' : 'module-tab'}>{tab}</button>
        ))}
      </nav>
      <main className="workspace">
        {imported && <div className="review-notice"><Info size={16} /><span>Invoice details extracted. Please review before saving.</span><button onClick={() => setImported(false)}><X size={14} /></button></div>}
        {imported && Object.values(ocrFlags).some(Boolean) && (
          <div className="review-inline">
            <span>Needs review</span>
            {ocrFlags.customer && <small>customer</small>}
            {ocrFlags.invoiceNo && <small>invoice no</small>}
            {ocrFlags.invoiceDate && <small>date</small>}
            {ocrFlags.items && <small>items</small>}
            {ocrFlags.eway && <small>e-way</small>}
          </div>
        )}
        <div className="page-heading"><div><h1>Sale Bill Creation</h1><span>Sales &gt; Sale Bill &gt; New</span></div><div className="status">Draft <span>•</span> Source: {source}</div></div>
        <section className="panel invoice-panel">
          <div className="panel-head"><strong>Invoice Details</strong><span className="muted">Fields marked <b>*</b> are required</span></div>
          <div className="invoice-grid">
            <Field label="Party" required className={`party-field ${ocrFlags.customer ? 'needs-review' : ''}`}><div className="with-action"><Select value={customer} onChange={(e) => setCustomer(e.target.value)}>{customers.map((name) => <option key={name}>{name}</option>)}</Select><button className="info-btn" title="Customer information"><Info size={13} /></button></div></Field>
            <Field label="Invoice Date" required className={ocrFlags.invoiceDate ? 'needs-review' : ''}><div className="input-icon"><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /><CalendarDays size={14} /></div></Field>
            <Field label="Invoice No." className={ocrFlags.invoiceNo ? 'needs-review' : ''}><input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></Field>
            <Field label="Godown / Location"><Select defaultValue="Main Godown"><option>Main Godown</option><option>Warehouse 2</option></Select></Field>
            <Field label="Interest Rate"><div className="dual-input"><input defaultValue="0" /><Select defaultValue="%"><option>%</option><option>Flat</option></Select></div></Field>
            <Field label="Due Date"><div className="input-icon"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /><CalendarDays size={14} /></div></Field>
            <Field label="Invoice Type"><Select defaultValue="Normal Invoice"><option>Normal Invoice</option><option>Retail Invoice</option><option>Export Invoice</option></Select></Field>
            <Field label="Shipping Address" className="address-field"><div className="with-action"><Select defaultValue="Factory Road, Mumbai"><option>Factory Road, Mumbai</option><option>Bhosari Industrial Area, Pune</option></Select><MiniButton title="Add shipping address" /></div></Field>
            <Field label="Billing Address (Place of Supply)" className="billing-address"><Select defaultValue="Bhosari Industrial Area, Pune"><option>Factory Road, Mumbai</option><option>Bhosari Industrial Area, Pune</option></Select></Field>
            <Field label="E-way Number" className={ocrFlags.eway ? 'needs-review' : ''}><input value={imported ? (ocrFlags.eway ? 'EWAY-IMPORT' : 'EWAY-786541') : ''} placeholder="Enter e-way number" /></Field>
            <Field label="Billing Currency"><Select defaultValue="₹ Rupees (INR-Indian)"><option>₹ Rupees (INR-Indian)</option><option>$ Dollar (USD)</option></Select></Field>
          </div>
        </section>

        <section className="panel items-panel"><div className="panel-head"><strong>Item / Service Detail</strong><span className="shortcut-hint">F9 Add Item</span></div><div className="item-controls"><Select><option>Select Items</option><option>Cotton Printed Shirt</option><option>Denim Trousers</option><option>Formal Jacket</option></Select><input placeholder="Scan barcode / enter item code" /><label className="radio"><input type="radio" defaultChecked name="stock" /> With Inventory</label><label className="radio"><input type="radio" name="stock" /> Without Inventory</label></div>
          <div className="table-scroll"><table className="data-table item-table"><thead><tr><th className="row-number">#</th><th>S.No.</th><th>Item / Service</th><th>Size</th><th>Color</th><th>Print</th><th>Category</th><th>Weight</th><th>Unit</th><th>MRP</th><th></th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id} className={ocrFlags.items ? 'row-needs-review' : ''}><td><button className="row-delete" onClick={() => setItems(items.filter((entry) => entry.id !== item.id))} title="Delete row"><Trash2 size={13} /></button></td><td className="serial">{index + 1}</td><td><Select value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)}><option value="">Select Items</option><option>Cotton Printed Shirt</option><option>Denim Trousers</option></Select></td><td><Select value={item.size} onChange={(e) => updateItem(item.id, 'size', e.target.value)}>{attributes.map((value) => <option key={value} value={value === 'Select Attribute' ? '' : value}>{value}</option>)}</Select></td><td><Select value={item.color} onChange={(e) => updateItem(item.id, 'color', e.target.value)}><option value="">Select Attribute</option><option>Blue</option><option>Black</option></Select></td><td><Select value={item.print} onChange={(e) => updateItem(item.id, 'print', e.target.value)}><option value="">Select Attribute</option><option>Floral</option><option>Plain</option></Select></td><td><Select value={item.category} onChange={(e) => updateItem(item.id, 'category', e.target.value)}><option value="">Select Attribute</option><option>Garments</option><option>Accessories</option></Select></td><td><input value={item.weight} onChange={(e) => updateItem(item.id, 'weight', e.target.value)} /></td><td><Select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)}><option value="">Select Unit</option><option>PCS</option><option>KG</option></Select></td><td><input value={item.mrp} onChange={(e) => updateItem(item.id, 'mrp', e.target.value)} placeholder="Select MRP" /></td><td><MiniButton onClick={addItem} title="Add item" /></td></tr>)}</tbody></table></div><div className="table-footer"><button type="button" className="link-button" onClick={addItem}>Press F9 to add</button><span>{items.length} item{items.length !== 1 ? 's' : ''}</span></div>
        </section>

        <Section title="Other Income / Discounts & Debits" shortcut="F8" open={open.charges} onToggle={() => toggle('charges')}><div className="table-scroll"><table className="data-table charges-table"><thead><tr><th>#</th><th>Charge</th><th>Add / Less</th><th>Amount</th><th>Tax</th><th>Tax Type</th><th>Tax Amount</th><th>Total</th></tr></thead><tbody>{charges.map((charge, index) => <tr key={charge.id}><td><MiniButton onClick={addCharge} title="Add charge" /></td><td><Select><option>Select Charge</option><option>Freight Charges</option><option>Packaging Charges</option></Select></td><td><Select defaultValue="Add"><option>Add</option><option>Less</option></Select></td><td><input defaultValue="0" /></td><td><Select><option>Not Include in GSTR</option><option>Include in GSTR</option></Select></td><td><Select defaultValue="Exclusive"><option>Exclusive</option><option>Inclusive</option></Select></td><td><input defaultValue="0" /></td><td><input defaultValue="0" /></td></tr>)}</tbody></table></div><div className="table-footer"><button type="button" className="link-button" onClick={addCharge}>Press F9 to add</button></div></Section>

        <div className="lower-grid"><div className="left-column"><section className="panel compact-panel"><div className="compact-row"><Field label="Bill Discount"><div className="dual-input"><Select defaultValue="%"><option>%</option><option>Amount</option></Select><input defaultValue="0" /></div></Field><Field label="Bank Name (On Invoice)"><Select><option>Select Bank</option><option>HDFC Bank - 4567</option></Select></Field><button className="custom-fields" type="button">ADD CUSTOM-FIELDS VALUES</button></div></section>
          <Section title="Transport Details" open={open.transport} onToggle={() => toggle('transport')}><div className="two-col"><Field label="Location To"><input placeholder="Enter location" /></Field><Field label="Vehicle Number"><input placeholder="Enter vehicle number" /></Field><Field label="Driver Name"><input placeholder="Enter driver name" /></Field><Field label="Transportation"><input placeholder="Enter transportation" /></Field></div></Section>
          <Section title="Referral Details" open={open.referral} onToggle={() => toggle('referral')}><div className="two-col"><Field label="Reference Type"><Select><option>Select Reference Type</option><option>Sales Executive</option><option>Customer Reference</option></Select></Field><Field label="Reference By"><Select><option>Select Reference By</option><option>Admin</option></Select></Field></div></Section>
          <Section title="Commercial Terms" open={open.terms} onToggle={() => toggle('terms')}><div className="table-scroll"><table className="data-table terms-table"><thead><tr><th>S.No.</th><th>Name</th><th>Value</th><th>#</th></tr></thead><tbody>{terms.map((term, index) => <tr key={term.id}><td>{index + 1}</td><td><Select><option>Terms Name</option><option>Delivery Terms</option><option>Payment Terms</option></Select></td><td><input placeholder="Terms Value" /></td><td><MiniButton onClick={addTerm} title="Add term" /></td></tr>)}</tbody></table></div></Section>
          <section className="panel remark-panel"><label className="field"><span>Remark / Narration</span><textarea placeholder="Enter remark or narration"></textarea></label></section>
        </div><aside className="right-column"><section className="panel summary-panel"><div className="summary-heading">Bill Profit Summary <Info size={14} /></div><div className="summary-line"><span>Total Sale</span><strong>0.00</strong></div><div className="summary-line"><span>Cost of Sale <Info size={12} /></span><strong>0.00</strong></div><div className="summary-line"><span>Bill Profit Amount</span><strong>0.00</strong></div><div className="summary-line"><span>Bill Profit Percentage</span><strong>0.00 %</strong></div></section><section className="panel summary-panel bill-summary"><div className="summary-heading">Bill Summary</div><div className="round-row"><span>Round Off</span><input defaultValue="0" /></div><div className="total-row"><span>Total Bill Amount</span><strong>0.00</strong></div></section><Section title="Payment Details" shortcut="F7" open={open.payment} onToggle={() => toggle('payment')}><Field label="Payment Mode"><Select><option>Cash</option><option>Bank</option><option>Credit</option></Select></Field><Field label="Amount"><input defaultValue="0" /></Field></Section></aside></div>

        <div className="bottom-bar"><div className="attachment-actions"><button className="attachment-btn" type="button" onClick={() => fileRef.current?.click()}><Paperclip size={15} /> ADD OR VIEW ATTACHMENTS</button>{attachment && <span className="attachment-name"><Upload size={13} /> {attachment} <button type="button" onClick={() => setAttachment(null)} title="Delete attachment"><Trash2 size={13} /></button></span>}</div><div className="bottom-actions"><button className="close-btn" type="button" onClick={closeForm}><X size={15} /> CLOSE</button><button className="save-btn" type="button" onClick={save}>{saved ? 'SAVED' : 'SAVE'}</button></div></div>
      </main>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
