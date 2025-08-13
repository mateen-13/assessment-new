import React, { useState, useEffect, useRef } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  differenceInCalendarDays,
  addWeeks,
  isWithinInterval,
} from "date-fns";

const uid = () => Math.random().toString(36).slice(2, 9);

const statusOptions = ["To Do", "In Progress", "Review", "Completed"];
const statusColors = {
  "To Do": "bg-blue-500",
  "In Progress": "bg-yellow-500",
  Review: "bg-purple-500",
  Completed: "bg-green-500",
};

export default function MonthPlanner() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("monthPlannerTasks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [editingTask, setEditingTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(statusOptions);
  const [timeFilter, setTimeFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectionRange, setSelectionRange] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [resizingTask, setResizingTask] = useState(null);
  const [resizeEdge, setResizeEdge] = useState(null);

  const calendarRef = useRef(null);

  const weeks = [];
  let day = startDate;
  while (day <= endDate) {
    weeks.push(
      Array(7)
        .fill(0)
        .map((_, i) => addDays(day, i))
    );
    day = addDays(day, 7);
  }

  useEffect(() => {
    localStorage.setItem("monthPlannerTasks", JSON.stringify(tasks));
  }, [tasks]);

  const filteredTasks = tasks.filter((task) => {
    if (!selectedStatuses.includes(task.status)) return false;

    if (
      searchTerm &&
      !task.title.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    if (timeFilter) {
      const today = new Date();
      const endDate = addWeeks(today, parseInt(timeFilter));
      if (
        !isWithinInterval(new Date(task.startDate), {
          start: today,
          end: endDate,
        })
      ) {
        return false;
      }
    }

    return true;
  });

  const getTasksForWeek = (weekStart, weekEnd) => {
    return filteredTasks
      .filter((task) => {
        if (!task.startDate) return false;
        const taskStart = new Date(task.startDate);
        const taskEnd = task.endDate ? new Date(task.endDate) : taskStart;
        return taskEnd >= weekStart && taskStart <= weekEnd;
      })
      .map((task) => {
        const taskStart = new Date(task.startDate);
        const taskEnd = task.endDate ? new Date(task.endDate) : taskStart;

        const adjustedStart = taskStart < weekStart ? weekStart : taskStart;
        const adjustedEnd = taskEnd > weekEnd ? weekEnd : taskEnd;

        const offset = differenceInCalendarDays(adjustedStart, weekStart);
        const length = differenceInCalendarDays(adjustedEnd, adjustedStart) + 1;

        return {
          ...task,
          offset,
          length,
          color: statusColors[task.status] || statusColors["To Do"],
        };
      })
      .sort((a, b) => a.offset - b.offset);
  };

  const createTask = (task) => {
    setTasks([...tasks, { ...task, id: uid() }]);
  };

  const updateTask = (id, updates) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData("task", JSON.stringify(task));
  };

  const handleDropOnDay = (e, day) => {
    e.preventDefault();
    const taskData = JSON.parse(e.dataTransfer.getData("task"));

    const taskStartStr = taskData.startDate;
    const taskEndStr = taskData.endDate || taskData.startDate;
    const daysDiff = differenceInCalendarDays(
      new Date(taskEndStr),
      new Date(taskStartStr)
    );

    const startDateStr = format(day, "yyyy-MM-dd");
    const endDateStr = format(addDays(day, daysDiff), "yyyy-MM-dd");

    updateTask(taskData.id, { startDate: startDateStr, endDate: endDateStr });
  };

  const handleMouseDown = (day) => {
    if (resizingTask) return;
    setIsSelecting(true);
    setSelectionRange({ start: day, end: day });
  };

  const handleMouseEnter = (day) => {
    if (isSelecting) {
      setSelectionRange((prev) => ({ ...prev, end: day }));
    }

    if (resizingTask) {
      handleResize(day);
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionRange) {
      const start = selectionRange.start;
      const end = selectionRange.end;
      const sortedDays = [start, end].sort((a, b) => a - b);

      setSelectionRange(null);
      setIsSelecting(false);

      setEditingTask({
        id: null,
        title: "",
        status: "To Do",
        startDate: format(sortedDays[0], "yyyy-MM-dd"),
        endDate: format(sortedDays[1], "yyyy-MM-dd"),
      });
      setIsModalOpen(true);
    }

    if (resizingTask) {
      setResizingTask(null);
      setResizeEdge(null);
    }
  };

  const startResizing = (task, edge, e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSelecting(false);
    setSelectionRange(null);
    setResizingTask(task);
    setResizeEdge(edge);
  };

  const handleResize = (day) => {
    if (resizingTask && resizeEdge) {
      const currentTask = tasks.find((t) => t.id === resizingTask.id);
      if (!currentTask) return;

      let newStartDate = new Date(currentTask.startDate);
      let newEndDate = currentTask.endDate
        ? new Date(currentTask.endDate)
        : new Date(currentTask.startDate);

      if (resizeEdge === "left") {
        if (day <= newEndDate) {
          newStartDate = day;
        } else {
          newStartDate = newEndDate;
        }
      } else {
        if (day >= newStartDate) {
          newEndDate = day;
        } else {
          newStartDate = day;
          if (newEndDate < newStartDate) {
            newEndDate = newStartDate;
          }
        }
      }

      updateTask(currentTask.id, {
        startDate: format(newStartDate, "yyyy-MM-dd"),
        endDate: format(newEndDate, "yyyy-MM-dd"),
      });
    }
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const toggleStatusFilter = (status) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  return (
    <div
      className="p-4 w-screen min-h-screen bg-gray-50 text-black"
      onMouseUp={handleMouseUp}
      ref={calendarRef}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {format(currentMonth, "MMMM yyyy")}
          </h1>

          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 rounded hover:bg-gray-200"
              >
                ◀
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 border rounded text-sm"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-2 rounded hover:bg-gray-200"
              >
                ▶
              </button>
            </div>

            <button
              onClick={() => {
                setEditingTask({
                  id: null,
                  title: "",
                  status: "To Do",
                  startDate: null,
                  endDate: null,
                });
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md"
            >
              New Task
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search tasks..."
            className="flex-1 px-4 py-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            value={timeFilter || ""}
            onChange={(e) => setTimeFilter(e.target.value || null)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="">All Time</option>
            <option value="1">Within 1 week</option>
            <option value="2">Within 2 weeks</option>
            <option value="3">Within 3 weeks</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatusFilter(status)}
              className={`px-3 py-1 rounded-md text-sm ${
                selectedStatuses.includes(status)
                  ? `${statusColors[status]} text-white`
                  : "bg-gray-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-4 bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden mb-px">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="p-2 bg-gray-100 text-gray-700 text-sm font-medium text-center"
                >
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => {
              const weekStart = week[0];
              const weekEnd = week[6];
              const weekTasks = getTasksForWeek(weekStart, weekEnd);

              const taskRows = [];
              weekTasks.forEach((task) => {
                let row = 0;
                while (
                  taskRows[row] &&
                  taskRows[row].some(
                    (t) =>
                      task.offset < t.offset + t.length &&
                      task.offset + task.length > t.offset
                  )
                ) {
                  row++;
                }
                if (!taskRows[row]) taskRows[row] = [];
                taskRows[row].push(task);
              });

              return (
                <div
                  key={wi}
                  className="grid grid-cols-7 gap-px bg-gray-200 relative min-h-[6rem]"
                >
                  {week.map((day, di) => {
                    const isSelected =
                      selectionRange &&
                      isWithinInterval(day, {
                        start: selectionRange.start,
                        end: selectionRange.end,
                      });

                    return (
                      <div
                        key={di}
                        className={`min-h-[100px] bg-white relative ${
                          !isSameMonth(day, monthStart)
                            ? "text-gray-400"
                            : "text-gray-800"
                        } ${
                          isSameDay(day, new Date())
                            ? "bg-blue-50 border border-blue-200"
                            : ""
                        } ${isSelected ? "bg-blue-100" : ""}`}
                        onMouseDown={() => handleMouseDown(day)}
                        onMouseEnter={() => handleMouseEnter(day)}
                        onMouseUp={handleMouseUp}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnDay(e, day)}
                      >
                        <div
                          className={`p-1 text-sm font-medium ${
                            isSameDay(day, new Date())
                              ? "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                              : ""
                          }`}
                        >
                          {format(day, "d")}
                        </div>
                      </div>
                    );
                  })}

                  {taskRows.map((rowTasks, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      {rowTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`absolute flex items-center px-2 text-white rounded ${task.color} text-xs font-medium h-6 cursor-move`}
                          style={{
                            top: `${1.5 + rowIndex * 1.75}rem`,
                            left: `${(task.offset / 7) * 100}%`,
                            width: `calc(${(task.length / 7) * 100}% - 2px)`,
                            margin: "1px",
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDoubleClick={() => openEditTaskModal(task)}
                        >
                          <div
                            className="absolute left-0 w-2 h-full cursor-w-resize z-10"
                            onMouseDown={(e) => startResizing(task, "left", e)}
                          />

                          <span className="truncate px-2">{task.title}</span>

                          <div
                            className="absolute right-0 w-2 h-full cursor-e-resize z-10"
                            onMouseDown={(e) => startResizing(task, "right", e)}
                          />
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black opacity-30"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {editingTask?.id ? "Edit Task" : "New Task"}
              </h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  value={editingTask?.title || ""}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, title: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={editingTask?.status || "To Do"}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, status: e.target.value })
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
className="w-full px-3 bg-gray-300 py-2 border rounded-md text-black [&::-webkit-calendar-picker-indicator]:filter-none [&::-webkit-calendar-picker-indicator]:invert-0"                    value={editingTask?.startDate || ""}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        startDate: e.target.value || null,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 bg-gray-300 py-2 border rounded-md text-black [&::-webkit-calendar-picker-indicator]:filter-none [&::-webkit-calendar-picker-indicator]:invert-0"
                    value={editingTask?.endDate || ""}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        endDate: e.target.value || null,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {editingTask?.id && (
                <button
                  className="px-4 py-2 text-red-600 border border-red-600 rounded-md"
                  onClick={() => {
                    deleteTask(editingTask.id);
                    setIsModalOpen(false);
                  }}
                >
                  Delete
                </button>
              )}
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                onClick={() => {
                  if (editingTask.id) {
                    updateTask(editingTask.id, editingTask);
                  } else {
                    createTask(editingTask);
                  }
                  setIsModalOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
