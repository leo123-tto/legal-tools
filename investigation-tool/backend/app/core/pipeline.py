from __future__ import annotations

from app.core.module_registry import get_registered_modules
from app.models.schemas import InvestigationContext, ModuleProgress
from app.services.task_store import TaskStore


class InvestigationPipeline:
    def __init__(self, task_store: TaskStore, stop_on_error: bool = False) -> None:
        self.task_store = task_store
        self.stop_on_error = stop_on_error
        self.modules = get_registered_modules()

    async def run(self, context: InvestigationContext) -> InvestigationContext:
        context.status = "running"
        context.module_progress = [
            ModuleProgress(module_id=module.module_id, module_name=module.module_name)
            for module in self.modules
        ]
        self.task_store.save(context)

        for progress, module in zip(context.module_progress, self.modules):
            if not module.should_run(context):
                progress.status = "skipped"
                context.add_log(module.module_id, "模块按配置跳过")
                self.task_store.save(context)
                continue

            context.current_module = module.module_name
            progress.status = "running"
            self.task_store.save(context)

            try:
                module.validate_input(context)
                context = await module.run(context)
                module.validate_output(context)
                progress.status = "completed"
            except Exception as exc:
                progress.status = "failed"
                context.add_error(module.module_id, str(exc))
                if self.stop_on_error:
                    context.status = "failed"
                    self.task_store.save(context)
                    return context
            finally:
                self.task_store.save(context)

        context.current_module = ""
        context.status = "failed" if any(item.status == "failed" for item in context.module_progress) else "completed"
        self.task_store.save(context)
        return context
