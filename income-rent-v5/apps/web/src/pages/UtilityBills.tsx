// Utility Bills Page - 水电费盈亏对比
import { useEffect, useMemo, useState } from "react";
import { utilityBillsApi } from "@/lib/api";
import { Building2, Droplets, Zap, TrendingUp, TrendingDown, Plus, Trash2, Eye } from "lucide-react";

function makeRoomKey(b: string | undefined, r: string | undefined): string {
  return (b || "").trim() + "::" + (r || "").replace(/\s+/g, "").toUpperCase();
}

export default function UtilityBillsPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    billType: "electric" as "electric" | "water",
    provider: "南方电网",
    billPeriod: new Date().toISOString().slice(0, 7),
    billingStart: "",
    billingEnd: "",
    totalAmount: 0,
    totalUsage: 0,
    building: "",
    meterNo: "",
    dueDate: "",
    paidDate: "",
    status: "unpaid" as "unpaid" | "paid",
    note: "",
  });

  // Item form state
  const [items, setItems] = useState<Array<{
    building: string;
    room: string;
    meterReadingStart: number;
    meterReadingEnd: number;
    usage: number;
    unitPrice: number;
    amount: number;
  }>>([]);

  async function load() {
    setLoading(true);
    try {
      const [b, r, p] = await Promise.all([
        utilityBillsApi.list({ period }),
        fetch(`/api/records?pageSize=1000`).then(res => res.json()),
        fetch(`/api/properties?pageSize=100`).then(res => res.json()),
      ]);
      setBills(b.data || []);
      setRecords(r.data?.items || r.data || []);
      setProperties(p.data?.items || p.data || []);
      setMsg("");
    } catch (e: any) {
      setMsg(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [period]);

  // Calculate profit/loss
  const profitLoss = useMemo(() => {
    // 1. 房东实际支付的水电费（支出）
    const electricPaid = bills
      .filter(b => b.billType === "electric")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const waterPaid = bills
      .filter(b => b.billType === "water")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // 2. 租客承担的水电费（收入）- 从上个月的 records 获取
    const [year, month] = period.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevCycle = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const prevRecords = records.filter(r => r.cycle === prevCycle);

    const electricFromTenants = prevRecords.reduce((sum, r) => {
      const usage = Number(r.electricUsage || 0);
      const price = Number(r.electricPrice || 0.8);
      return sum + usage * price;
    }, 0);

    const waterFromTenants = prevRecords.reduce((sum, r) => {
      const usage = Number(r.waterUsage || 0);
      const price = Number(r.waterPrice || 5.5);
      return sum + usage * price;
    }, 0);

    return {
      period,
      billingPeriod: prevCycle,
      expense: {
        electric: electricPaid,
        water: waterPaid,
        total: electricPaid + waterPaid,
      },
      income: {
        electric: electricFromTenants,
        water: waterFromTenants,
        total: electricFromTenants + waterFromTenants,
      },
      profit: {
        electric: electricFromTenants - electricPaid,
        water: waterFromTenants - waterPaid,
        total: (electricFromTenants + waterFromTenants) - (electricPaid + waterPaid),
      },
    };
  }, [bills, records, period]);

  // Get unique buildings from properties
  const buildings = useMemo(() => {
    const bldSet = new Set<string>();
    properties.forEach(p => {
      if (p.building) bldSet.add(p.building);
    });
    return Array.from(bldSet).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [properties]);

  // Get rooms for selected building
  const roomsForBuilding = useMemo(() => {
    if (!formData.building) return [];
    return properties
      .filter(p => p.building === formData.building && p.usageType !== "自用（不出租）")
      .sort((a, b) => {
        const na = parseInt(String(a.room || "").match(/\d+/)?.[0] || "0");
        const nb = parseInt(String(b.room || "").match(/\d+/)?.[0] || "0");
        return na - nb || String(a.room || "").localeCompare(String(b.room || ""));
      });
  }, [properties, formData.building]);

  function addItem() {
    setItems([...items, {
      building: formData.building,
      room: "",
      meterReadingStart: 0,
      meterReadingEnd: 0,
      usage: 0,
      unitPrice: formData.billType === "electric" ? 0.8 : 5.5,
      amount: 0,
    }]);
  }

  function updateItem(index: number, field: string, value: any) {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;

    // Auto-calculate usage and amount
    if (field === "meterReadingStart" || field === "meterReadingEnd") {
      const start = Number(newItems[index].meterReadingStart);
      const end = Number(newItems[index].meterReadingEnd);
      if (end > start) {
        newItems[index].usage = end - start;
        newItems[index].amount = (end - start) * Number(newItems[index].unitPrice);
      }
    }

    setItems(newItems);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!formData.building || !formData.totalAmount) {
      setMsg("请填写楼栋和账单金额");
      return;
    }

    try {
      await utilityBillsApi.createWithItems(formData, items);
      setMsg("账单已保存");
      setShowForm(false);
      load();
    } catch (e: any) {
      setMsg(e.message || "保存失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除此账单？")) return;
    try {
      await utilityBillsApi.delete(id);
      setMsg("已删除");
      load();
    } catch (e: any) {
      setMsg(e.message || "删除失败");
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-slate-500">加载中...</p></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-4 text-white">
        <h1 className="text-lg font-bold">💧⚡ 水电费盈亏对比</h1>
        <p className="text-xs opacity-80 mt-1">记录房东支付的水务/电网账单，对比租客承担的水电费</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            className="rounded-lg px-3 py-1.5 text-sm text-slate-900"
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          />
          <button
            className="rounded-lg bg-white/20 px-3 py-1.5 text-xs flex items-center gap-1"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3 w-3" /> 新增账单
          </button>
        </div>
      </div>

      {msg && <div className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-700">{msg}</div>}

      {/* 提示：数据来源于上月账单 */}
      {profitLoss.income.total === 0 && profitLoss.expense.total > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
          ⚠️ 本月盈亏对比显示租客承担费用为 0，请先同步<strong>{profitLoss.billingPeriod}</strong>月的抄表数据到账单
        </div>
      )}

      {/* Profit/Loss Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Building2 className="h-4 w-4" />
            <span>房东支出（{period}账单）</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600">
            ¥{profitLoss.expense.total.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            电费: ¥{profitLoss.expense.electric.toFixed(2)} | 水费: ¥{profitLoss.expense.water.toFixed(2)}
          </div>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <TrendingUp className="h-4 w-4" />
            <span>租客承担（{profitLoss.billingPeriod}用量）</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-green-600">
            ¥{profitLoss.income.total.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            电费: ¥{profitLoss.income.electric.toFixed(2)} | 水费: ¥{profitLoss.income.water.toFixed(2)}
          </div>
        </div>

        <div className={`rounded-2xl bg-white ring-1 ring-slate-200 p-4 ${profitLoss.profit.total >= 0 ? "ring-green-300" : "ring-red-300"}`}>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            {profitLoss.profit.total >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>盈亏</span>
          </div>
          <div className={`mt-2 text-2xl font-bold ${profitLoss.profit.total >= 0 ? "text-green-600" : "text-red-600"}`}>
            {profitLoss.profit.total >= 0 ? "+" : ""}¥{profitLoss.profit.total.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            电: {profitLoss.profit.electric >= 0 ? "+" : ""}¥{profitLoss.profit.electric.toFixed(2)} |
            水: {profitLoss.profit.water >= 0 ? "+" : ""}¥{profitLoss.profit.water.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Bills List */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">
          账单列表
        </div>
        {bills.length === 0 ? (
          <div className="p-4 text-center text-slate-500">暂无账单</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {bills.map(bill => (
              <div key={bill.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bill.billType === "electric" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"}`}>
                    {bill.billType === "electric" ? <Zap className="h-4 w-4" /> : <Droplets className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-medium">
                      {bill.billType === "electric" ? "电费" : "水费"} - {bill.building || "未指定"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {bill.provider} | 账单月份: {bill.billPeriod} | 用量: {bill.totalUsage || "-"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">¥{bill.totalAmount.toFixed(2)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${bill.status === "paid" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}>
                    {bill.status === "paid" ? "已付" : "未付"}
                  </span>
                  <button
                    className="p-1 text-slate-400 hover:text-blue-600"
                    onClick={() => setSelectedBill(bill)}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1 text-slate-400 hover:text-red-600"
                    onClick={() => handleDelete(bill.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Bill Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-lg font-semibold">新增水电费账单</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">类型</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.billType}
                  onChange={e => setFormData({ ...formData, billType: e.target.value as any, provider: e.target.value === "electric" ? "南方电网" : "深圳水务" })}
                >
                  <option value="electric">电费</option>
                  <option value="water">水费</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">供应商</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.provider}
                  onChange={e => setFormData({ ...formData, provider: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">账单月份</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="month"
                  value={formData.billPeriod}
                  onChange={e => setFormData({ ...formData, billPeriod: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">楼栋</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.building}
                  onChange={e => setFormData({ ...formData, building: e.target.value })}
                >
                  <option value="">选择楼栋</option>
                  {buildings.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">账单金额</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  step="0.01"
                  value={formData.totalAmount || ""}
                  onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">总用量</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  value={formData.totalUsage || ""}
                  onChange={e => setFormData({ ...formData, totalUsage: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">起始日期</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="date"
                  value={formData.billingStart}
                  onChange={e => setFormData({ ...formData, billingStart: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">结束日期</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="date"
                  value={formData.billingEnd}
                  onChange={e => setFormData({ ...formData, billingEnd: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">支付日期</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  type="date"
                  value={formData.paidDate}
                  onChange={e => setFormData({ ...formData, paidDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">状态</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="unpaid">未付</option>
                  <option value="paid">已付</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">备注</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={formData.note}
                onChange={e => setFormData({ ...formData, note: e.target.value })}
              />
            </div>

            {/* Items Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-slate-600">房间明细</label>
                <button
                  className="text-xs text-blue-600 hover:text-blue-800"
                  onClick={addItem}
                >
                  + 添加房间
                </button>
              </div>
              {items.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">
                  暂无明细，点击「添加房间」手动添加
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <select
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                        value={item.room}
                        onChange={e => updateItem(index, "room", e.target.value)}
                      >
                        <option value="">选择房间</option>
                        {roomsForBuilding.map(p => (
                          <option key={p.room} value={p.room}>{p.room}</option>
                        ))}
                      </select>
                      <input
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                        type="number"
                        placeholder="起始"
                        value={item.meterReadingStart || ""}
                        onChange={e => updateItem(index, "meterReadingStart", Number(e.target.value))}
                      />
                      <input
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                        type="number"
                        placeholder="结束"
                        value={item.meterReadingEnd || ""}
                        onChange={e => updateItem(index, "meterReadingEnd", Number(e.target.value))}
                      />
                      <input
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                        type="number"
                        placeholder="用量"
                        value={item.usage || ""}
                        onChange={e => updateItem(index, "usage", Number(e.target.value))}
                      />
                      <input
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                        type="number"
                        step="0.01"
                        placeholder="金额"
                        value={item.amount || ""}
                        onChange={e => updateItem(index, "amount", Number(e.target.value))}
                      />
                      <button
                        className="p-1 text-red-500 hover:text-red-700"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
              <button
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white"
                onClick={handleSubmit}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-lg font-semibold">账单详情</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">类型</span>
                <span>{selectedBill.billType === "electric" ? "电费" : "水费"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">供应商</span>
                <span>{selectedBill.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">账单月份</span>
                <span>{selectedBill.billPeriod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">楼栋</span>
                <span>{selectedBill.building || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">金额</span>
                <span className="font-bold">¥{selectedBill.totalAmount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">用量</span>
                <span>{selectedBill.totalUsage || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">状态</span>
                <span className={selectedBill.status === "paid" ? "text-green-600" : "text-orange-600"}>
                  {selectedBill.status === "paid" ? "已付" : "未付"}
                </span>
              </div>
              {selectedBill.note && (
                <div className="flex justify-between">
                  <span className="text-slate-500">备注</span>
                  <span>{selectedBill.note}</span>
                </div>
              )}
            </div>
            <button
              className="w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium"
              onClick={() => setSelectedBill(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
