import React, { useState, useEffect } from "react";
import { getFirebaseDb } from "../firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { 
  EventDoc, 
  ReminderRule, 
  ReminderTemplate 
} from "../types";
import { 
  X, 
  Save, 
  Clock, 
  Layers, 
  Plus, 
  Trash2, 
  HelpCircle, 
  AlertCircle,
  Check
} from "lucide-react";
import { motion } from "motion/react";

interface EventFormProps {
  userId: string;
  eventToEdit?: EventDoc | null;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function EventForm({ userId, eventToEdit, onClose, onSaveSuccess }: EventFormProps) {
  const [title, setTitle] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("custom");
  const [customRules, setCustomRules] = useState<ReminderRule[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const db = getFirebaseDb();

  // Load reminder templates from Firestore
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "reminder_templates"));
        const list: ReminderTemplate[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as ReminderTemplate);
        });
        setTemplates(list);
      } catch (err) {
        console.error("Error fetching templates:", err);
      }
    };
    fetchTemplates();
  }, []);

  // Pre-fill form if editing
  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title);
      // Convert to local datetime-local format
      // ISO like 2026-06-20T11:15:00.000Z -> 2026-06-20T11:15
      if (eventToEdit.eventTime) {
        setEventTime(eventToEdit.eventTime.substring(0, 16));
      }
      setLink(eventToEdit.link || "");
      setNotes(eventToEdit.notes || "");
      
      const tId = (eventToEdit as any).templateId || "custom";
      setSelectedTemplateId(tId);
      
      if (tId === "custom") {
        setCustomRules(eventToEdit.reminderRules || []);
      }
    } else {
      // Set default dynamic time: now + 24 hours
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setEventTime(tomorrow.toISOString().substring(0, 16));
      setTitle("");
      setLink("");
      setNotes("");
      setSelectedTemplateId("custom");
      setCustomRules([
        {
          type: "hours_before",
          hoursBefore: 1,
          channels: ["browser", "desktop"],
        },
      ]);
    }
  }, [eventToEdit]);

  // Handle template selection change
  const handleTemplateChange = (val: string) => {
    setSelectedTemplateId(val);
    if (val !== "custom") {
      // rules cloned from templates are stored with templateId, we don't display inputs
      setCustomRules([]);
    } else {
      // initialize default rule if switching back to custom
      setCustomRules([
        {
          type: "hours_before",
          hoursBefore: 1,
          channels: ["browser", "desktop"],
        },
      ]);
    }
  };

  // Custom rule manipulation helpers
  const addCustomRule = () => {
    setCustomRules([
      ...customRules,
      {
        type: "minutes_before",
        minutesBefore: 30,
        channels: ["browser"],
      },
    ]);
  };

  const removeCustomRule = (index: number) => {
    setCustomRules(customRules.filter((_, idx) => idx !== index));
  };

  const updateRuleField = (index: number, field: keyof ReminderRule, val: any) => {
    const updated = [...customRules];
    updated[index] = { ...updated[index], [field]: val } as ReminderRule;
    setCustomRules(updated);
  };

  const handleChannelCheckboxChange = (index: number, channel: "telegram" | "desktop" | "browser", checked: boolean) => {
    const updated = [...customRules];
    const currentChannels = updated[index].channels || [];
    if (checked) {
      if (!currentChannels.includes(channel)) {
        updated[index].channels = [...currentChannels, channel];
      }
    } else {
      updated[index].channels = currentChannels.filter((c) => c !== channel);
    }
    setCustomRules(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!title.trim()) {
      setErrorMsg("يرجى كتابة عنوان الحدث بشكل صحيح.");
      return;
    }
    if (!eventTime) {
      setErrorMsg("يرجى تحديد موعد الحدث بدقة.");
      return;
    }

    setLoading(true);
    try {
      // Determine reminder rules to save
      let rulesToSave: ReminderRule[] = [];
      if (selectedTemplateId === "custom") {
        rulesToSave = customRules;
      } else {
        const chosenTemplate = templates.find((t) => t.id === selectedTemplateId);
        rulesToSave = chosenTemplate ? chosenTemplate.rules : [];
      }

      // Convert local date String to global UTC ISO String
      const utcTimeIso = new Date(eventTime).toISOString();

      const eventPayload: Partial<EventDoc> = {
        userId,
        title,
        eventTime: utcTimeIso,
        link: link.trim() || "",
        notes: notes.trim() || "",
        status: eventToEdit ? eventToEdit.status : "active",
        reminderRules: rulesToSave,
        updatedAt: new Date().toISOString() as any,
      };

      if (selectedTemplateId !== "custom") {
        (eventPayload as any).templateId = selectedTemplateId || "";
      } else {
        (eventPayload as any).templateId = "";
      }

      if (eventToEdit && eventToEdit.id) {
        // Update existing Firestore doc
        const docRef = doc(db, "events", eventToEdit.id);
        await updateDoc(docRef, eventPayload);
      } else {
        // Create new Firestore doc
        eventPayload.createdAt = new Date().toISOString();
        const eventsCol = collection(db, "events");
        await addDoc(eventsCol, eventPayload);
      }

      onSaveSuccess();
    } catch (err: any) {
      console.error("Error saving event:", err);
      setErrorMsg("حدث خطأ أثناء حفظ التعديلات: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden text-right"
        dir="rtl"
        id="event-form-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-slate-800" id="form-heading">
              {eventToEdit ? "تعديل تفاصيل الحدث القائم" : "إضافة حدث وتذكير جديد"}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition shrink-0 cursor-pointer"
            id="close-form-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-sm flex items-center gap-2 text-right">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 block">عنوان الحدث / المهمة *</label>
              <input 
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 text-sm"
                placeholder="رخصة القيادة، محاضرة، موعد طبي..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                id="event-title-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 block">موعد وتاريخ الحدث الفعلي *</label>
              <input 
                type="datetime-local"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 text-sm font-mono"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                id="event-time-input"
              />
            </div>
          </div>

          {/* Optional URL Link & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 block">رابط مرجعي خارجي (اختياري)</label>
              <input 
                type="url"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 text-sm text-left"
                placeholder="https://absher.sa"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                id="event-link-input"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 block">ملاحظات توضيحية / إضافية (اختياري)</label>
              <input 
                type="text"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 text-sm"
                placeholder="جلب صورة الهوية وفحص النظر مسبقاً..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                id="event-notes-input"
              />
            </div>
          </div>

          {/* Template Selector Section */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <label className="text-sm font-bold text-slate-700">قواعد التذكير الذكية لحساب التنبيهات</label>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                اختر أحد قوالب التذكير الخمسة الجاهزة، أو استكشف الخيار «مخصص» لتصميم وتحديد فواصل تنبيهات متقدمة بنفسك.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleTemplateChange("custom")}
                  className={`p-3 rounded-xl border text-right transition font-medium flex flex-col justify-between h-20 cursor-pointer ${
                    selectedTemplateId === "custom"
                      ? "border-amber-500 bg-amber-500/5 text-amber-900"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                  }`}
                  id="template-custom-btn"
                >
                  <span className="text-xs font-bold block">🔧 تذكير مخصص</span>
                  <span className="text-[10px] text-slate-500">حدد الفواصل الزمنية والقنوات يدوياً.</span>
                </button>

                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleTemplateChange(tpl.id)}
                    className={`p-3 rounded-xl border text-right transition font-medium flex flex-col justify-between h-20 cursor-pointer ${
                      selectedTemplateId === tpl.id
                        ? "border-amber-500 bg-amber-500/5 text-amber-900"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                    }`}
                    id={`template-${tpl.id}-btn`}
                  >
                    <span className="text-xs font-bold block truncate">{tpl.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-2 leading-tight">{tpl.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Rules Configurator (Enabled only if "custom" template chosen) */}
          {selectedTemplateId === "custom" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">مجموع القواعد المحددة الحالية:</span>
                <button 
                  type="button"
                  onClick={addCustomRule}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  id="add-rule-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة قاعدة تذكير</span>
                </button>
              </div>

              {customRules.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  لا توجد أي قواعد تذكير حالية. ينصح على الأقل بإضافة قاعدة تذكير واحدة ليصلك منبه في حينه.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {customRules.map((rule, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 bg-white rounded-xl border border-slate-200 space-y-3.5 relative"
                      id={`custom-rule-${idx}`}
                    >
                      <button
                        type="button"
                        onClick={() => removeCustomRule(idx)}
                        className="absolute left-3 top-3 p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                        title="حذف القاعدة"
                        id={`delete-rule-${idx}-btn`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Rule Type */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 block">نوع الفاصل الزمني</label>
                          <select
                            className="text-xs w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none"
                            value={rule.type}
                            onChange={(e) => updateRuleField(idx, "type", e.target.value)}
                            id={`rule-${idx}-type`}
                          >
                            <option value="days_before">أيام قبل البدء (days_before)</option>
                            <option value="hours_before">ساعات قبل البدء (hours_before)</option>
                            <option value="minutes_before">دقائق قبل البدء (minutes_before)</option>
                            <option value="at_time">وقت الموعد تماماً (at_time)</option>
                          </select>
                        </div>

                        {/* Condition Values */}
                        <div className="space-y-1">
                          {rule.type === "days_before" && (
                            <>
                              <label className="text-[11px] font-bold text-slate-500 block">عدد الأيام</label>
                              <input 
                                type="number" 
                                min={1}
                                required
                                className="text-xs w-full px-3 py-2 rounded-lg border border-slate-200 text-center font-bold"
                                value={rule.daysBefore || 1}
                                onChange={(e) => updateRuleField(idx, "daysBefore", parseInt(e.target.value, 10))}
                                id={`rule-${idx}-days-val`}
                              />
                            </>
                          )}
                          {rule.type === "hours_before" && (
                            <>
                              <label className="text-[11px] font-bold text-slate-500 block">عدد الساعات</label>
                              <input 
                                type="number" 
                                min={1}
                                required
                                className="text-xs w-full px-3 py-2 rounded-lg border border-slate-200 text-center font-bold"
                                value={rule.hoursBefore || 1}
                                onChange={(e) => updateRuleField(idx, "hoursBefore", parseInt(e.target.value, 10))}
                                id={`rule-${idx}-hours-val`}
                              />
                            </>
                          )}
                          {rule.type === "minutes_before" && (
                            <>
                              <label className="text-[11px] font-bold text-slate-500 block">عدد الدقائق</label>
                              <input 
                                type="number" 
                                min={1}
                                required
                                className="text-xs w-full px-3 py-2 rounded-lg border border-slate-200 text-center font-bold"
                                value={rule.minutesBefore || 30}
                                onChange={(e) => updateRuleField(idx, "minutesBefore", parseInt(e.target.value, 10))}
                                id={`rule-${idx}-mins-val`}
                              />
                            </>
                          )}
                          {rule.type === "at_time" && (
                            <div className="text-[11px] text-slate-400 pt-5 pr-1">
                              * سيصلك الإشعار بالتزامن مع توقيت وموعد الحدث تماماً بدون أي فارق فرعي.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Days Before: Times Entry */}
                      {rule.type === "days_before" && (
                        <div className="space-y-1 pt-1">
                          <label className="text-[11px] font-bold text-slate-500 block">مواقيت التنبيه المحددة يومها (بتنسيق HH:MM مفصولة بفاصلة) *</label>
                          <input 
                            type="text"
                            required
                            className="text-xs w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-left"
                            placeholder="09:00, 21:00"
                            value={rule.times ? rule.times.join(", ") : "09:00"}
                            onChange={(e) => {
                              const arr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                              updateRuleField(idx, "times", arr);
                            }}
                            id={`rule-${idx}-times`}
                            dir="ltr"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                            * ملاحظة: يجب كتابة مواقيت دقيقة بنمط 24 ساعة (مثلاً: 09:00 للصباح، 21:00 للمساء).
                          </p>
                        </div>
                      )}

                      {/* Notification Channels selection */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                        <span className="text-[11px] font-bold text-slate-500">قنوات الإمداد بالتنبيه:</span>
                        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-700">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={(rule.channels || []).includes("browser")}
                              onChange={(e) => handleChannelCheckboxChange(idx, "browser", e.target.checked)}
                              className="accent-amber-600 rounded"
                            />
                            <span>إشعارات المتصفح المنبثقة</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={(rule.channels || []).includes("telegram")}
                              onChange={(e) => handleChannelCheckboxChange(idx, "telegram", e.target.checked)}
                              className="accent-amber-600 rounded"
                            />
                            <span>بوت تيليجرام (Telegram)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={(rule.channels || []).includes("desktop")}
                              onChange={(e) => handleChannelCheckboxChange(idx, "desktop", e.target.checked)}
                              className="accent-amber-600 rounded"
                            />
                            <span>جهاز الكمبيوتر (Windows Desktop)</span>
                          </label>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-start gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition cursor-pointer"
            id="save-event-btn"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>جاري الحفظ والجدولة...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات وجدولة التنبيهات</span>
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer"
            id="cancel-event-btn"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}
