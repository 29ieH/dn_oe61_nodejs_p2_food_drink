## Checklist tự review pull trước khi ready để trainer review

- [ ] Sử dụng thụt lề 2 spaces/4 spaces đồng nhất ở tất cả các files (setting lại VSCode / WebStorm / ... nếu chưa cài đặt)
- [ ] Cuối mỗi file kiểm tra có end line (khi đẩy lên git xem file change không bị lỗi tròn đỏ ở cuối file)
- [ ] Mỗi dòng nếu quá dài, cần xuống dòng (maximum: 100 kí tự mỗi dòng, setting trong IDE)
- [ ] gitignore các file chứa thông tin nhạy cảm (VD: `.env`, `dist/`, `node_modules/`, ...)
- [ ] Tham khảo [NestJS Best Practices](https://hackernoon.com/nestjs-and-best-practices) và [TypeScript Coding Guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines)
- [ ] Kiểm tra mỗi pull request chỉ 1 commit, nếu nhiều hơn 1 commit thì hãy gộp commit thành 1 rồi đẩy lại lên git
- [ ] Đã chạy `npm run lint` hoặc `yarn lint` để fix lỗi syntax, convention. Khi gửi thì chụp ảnh PASS đính kèm trong pull
- [ ] Đã chạy `npm run format` hoặc `yarn format` (Prettier) để format code đồng nhất
- [ ] Nếu có unit test thì đảm bảo chạy `npm run test` PASS trước khi tạo pull
- [ ] Nếu làm việc nhóm trong project thì mỗi pull cần **ít nhất 1 APPROVED** từ thành viên trong nhóm

---

## Related Tickets
- ticket redmine / jira link

## WHAT (optional)
- Change number items `completed/total` in admin page.

## HOW
- I edit service and controller, inject `not_vary_normal` items in calculate function.

## WHY (optional)
- Because in previous version - number just depends on `normal` items.  
- But in new version, we have `state` and `confirm_state` depends on both `normal` + `not_normal` items.

## Evidence (Screenshot or Video)

## Notes (Kiến thức tìm hiểu thêm)
- NestJS Dependency Injection
- DTO & Validation (class-validator, class-transformer)
- Error handling best practices
